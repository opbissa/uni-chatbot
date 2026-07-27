import { chunkText } from "./chunk.js";
import { embed } from "./embed.js";
import { upsertChunks } from "./upsert.js";
import { extractPdfText } from "./pdf.js";

/** Shared by the crawler's auto-process path and the pdf-ingest worker (approved backlog). */
export async function processPdfUrl(
  tenantId: string,
  pdfUrl: string,
  pageTitle: string | null
): Promise<void> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

  const pdfBuffer = Buffer.from(await res.arrayBuffer());
  const text = (await extractPdfText(pdfBuffer)).replace(/\s+/g, " ").trim();
  if (!text) return;

  const chunks = chunkText(text);
  const embeddings = await Promise.all(chunks.map((c) => embed(c.text)));
  await upsertChunks(tenantId, chunks, { sourceUrl: pdfUrl, pageTitle }, embeddings);
}
