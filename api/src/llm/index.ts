import { generateWithOllama } from "./ollama.js";
import { generateWithClaude } from "./claude.js";

export interface GenerateParams {
  systemPrompt: string;
  question: string;
  context: string;
}

export type LlmProvider = "ollama" | "claude";

/** Per-tenant routing: config change, not a refactor. */
export function generate(provider: LlmProvider, params: GenerateParams): AsyncIterable<string> {
  switch (provider) {
    case "ollama":
      return generateWithOllama(params);
    case "claude":
      return generateWithClaude(params);
  }
}
