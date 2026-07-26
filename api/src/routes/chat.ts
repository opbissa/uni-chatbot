import type { FastifyInstance } from "fastify";
import { resolveTenantByKey, isOriginAllowed } from "../tenants/resolve.js";
import { retrieve } from "../rag/retrieve.js";
import { generate } from "../llm/index.js";

const SYSTEM_PROMPT =
  "You are a helpful university assistant. Answer only from the provided " +
  "context (exams, syllabus, news, fees, admissions). Respond in the " +
  "language the student used (Hindi, English, or Hinglish). If the context " +
  "doesn't contain the answer, say you don't know and suggest contacting " +
  "the university office.";

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

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    for await (const token of generate(tenant.llmProvider, { systemPrompt: SYSTEM_PROMPT, question, context })) {
      reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    reply.raw.write(
      `data: ${JSON.stringify({ done: true, sources: chunks.map((c) => c.sourceUrl) })}\n\n`
    );
    reply.raw.end();
  });
}
