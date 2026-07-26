import Anthropic from "@anthropic-ai/sdk";
import type { GenerateParams } from "./index.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function* generateWithClaude(params: GenerateParams): AsyncIterable<string> {
  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: params.systemPrompt,
    messages: [
      {
        role: "user",
        content: `Context:\n${params.context}\n\nQuestion: ${params.question}`,
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
