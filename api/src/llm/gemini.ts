import { GoogleGenAI } from "@google/genai";
import type { GenerateParams } from "./index.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const GENERATE_MODEL = process.env.GEMINI_GENERATE_MODEL ?? "gemini-flash-latest";

export async function* generateWithGemini(params: GenerateParams): AsyncIterable<string> {
  const stream = await client.models.generateContentStream({
    model: GENERATE_MODEL,
    contents: `Context:\n${params.context}\n\nQuestion: ${params.question}`,
    config: {
      systemInstruction: params.systemPrompt,
      maxOutputTokens: 1024,
      abortSignal: params.signal,
    },
  });

  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
