import type { GenerateParams } from "./index.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "bge-m3";
const GENERATE_MODEL = process.env.OLLAMA_GENERATE_MODEL ?? "qwen2.5:7b";

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings[0];
}

export async function* generateWithOllama(params: GenerateParams): AsyncIterable<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GENERATE_MODEL,
      prompt: `${params.systemPrompt}\n\nContext:\n${params.context}\n\nQuestion: ${params.question}`,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Ollama generate failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as { response: string; done: boolean };
      if (chunk.response) yield chunk.response;
    }
  }
}
