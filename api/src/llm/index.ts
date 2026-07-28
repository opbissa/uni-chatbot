import { generateWithOllama } from "./ollama.js";
import { generateWithClaude } from "./claude.js";
import { generateWithGemini } from "./gemini.js";

export interface GenerateParams {
  systemPrompt: string;
  question: string;
  context: string;
  signal?: AbortSignal;
}

export type LlmProvider = "ollama" | "claude" | "gemini";

/** Per-tenant routing: config change, not a refactor. */
export function generate(provider: LlmProvider, params: GenerateParams): AsyncIterable<string> {
  switch (provider) {
    case "ollama":
      return generateWithOllama(params);
    case "claude":
      return generateWithClaude(params);
    case "gemini":
      return generateWithGemini(params);
  }
}
