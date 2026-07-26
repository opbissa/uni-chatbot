import { pool } from "../db/pool.js";
import type { Chunk } from "./chunk.js";

export interface Provenance {
  sourceUrl: string;
  pageTitle: string | null;
}

export async function upsertChunks(tenantId: string, chunks: Chunk[], provenance: Provenance, embeddings: number[][]) {
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO chunks (tenant_id, embedding, text, source_url, page_title, crawled_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [tenantId, JSON.stringify(embeddings[i]), chunks[i].text, provenance.sourceUrl, provenance.pageTitle]
    );
  }
}
