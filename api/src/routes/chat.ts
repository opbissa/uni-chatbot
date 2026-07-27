import type { FastifyInstance } from "fastify";
import { resolveTenantByKey, isOriginAllowed } from "../tenants/resolve.js";
import { retrieve } from "../rag/retrieve.js";
import { generate } from "../llm/index.js";

const SYSTEM_PROMPT =
  "You are a helpful university assistant. Answer only from the provided " +
  "context (exams, syllabus, news, fees, admissions). Respond in the " +
  "language the student used (Hindi, English, or Hinglish). If the context " +
  "doesn't contain the answer, say you don't know and suggest contacting " +
  "the university office. Format your answer in Markdown: use \"- \" bullet " +
  "lists or \"1. \" numbered lists for multiple items or steps, and **bold** " +
  "for key terms like dates, fees, or document names.";

export async function chatRoutes(app: FastifyInstance) {
  app.post<{ Body: { tenantKey: string; question: string } }>("/chat", async (request, reply) => {
    const { tenantKey, question } = request.body;

    const tenant = await resolveTenantByKey(tenantKey);
    if (!tenant) return reply.code(404).send({ error: "unknown tenant" });

    if (!isOriginAllowed(tenant, request.headers.origin)) {
      return reply.code(403).send({ error: "origin not allowed for this tenant" });
    }

    const chunks = await retrieve(tenant.id, question);
    const context = chunks
      .map((c) => `[${c.pageTitle ?? c.sourceUrl}]\n${c.text}`)
      .join("\n\n");

    // @fastify/cors only injects headers on the normal reply.send() pipeline;
    // this route writes straight to reply.raw for SSE, so the header must be
    // set here too. Safe to reflect verbatim: isOriginAllowed already checked
    // this exact origin against the tenant's registered domains above.
    reply.raw.setHeader("Access-Control-Allow-Origin", request.headers.origin!);
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    const controller = new AbortController();
    reply.raw.on("close", () => controller.abort());

    try {
      for await (const token of generate(tenant.llmProvider, {
        systemPrompt: SYSTEM_PROMPT,
        question,
        context,
        signal: controller.signal,
      })) {
        if (reply.raw.destroyed) break;
        reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // client already disconnected, nothing left to send
      } else {
        app.log.error(err);
        if (!reply.raw.destroyed) {
          reply.raw.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
        }
      }
    }
    if (!reply.raw.destroyed) {
      reply.raw.write(
        `data: ${JSON.stringify({ done: true, sources: chunks.map((c) => c.sourceUrl) })}\n\n`
      );
      reply.raw.end();
    }
  });
}
