import { pool } from "../db/pool.js";
import { embed } from "../llm/ollama.js";

export interface RetrievedChunk {
  id: string;
  text: string;
  sourceUrl: string;
  pageTitle: string | null;
}

/** Retrieval ALWAYS filters by tenant_id server-side. */
export async function retrieve(tenantId: string, question: string, topK = 5): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embed(question);
  const { rows } = await pool.query(
    `SELECT id, text, source_url, page_title
     FROM chunks
     WHERE tenant_id = $1
     ORDER BY embedding <=> $2
     LIMIT $3`,
    [tenantId, JSON.stringify(queryEmbedding), topK]
  );
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    sourceUrl: r.source_url,
    pageTitle: r.page_title,
  }));
}
