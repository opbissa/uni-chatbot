import { pool } from "../db/pool.js";

export interface PendingPdf {
  tenantId: string;
  sourceUrl: string;
  linkText: string | null;
  discoveredFromUrl: string;
  sizeBytes: number | null;
}

/** Idempotent per (tenant_id, source_url): re-crawling a page won't re-queue an already-seen PDF. */
export async function insertPendingPdf(pdf: PendingPdf): Promise<void> {
  await pool.query(
    `INSERT INTO pdf_documents (tenant_id, source_url, link_text, discovered_from_url, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, source_url) DO NOTHING`,
    [pdf.tenantId, pdf.sourceUrl, pdf.linkText, pdf.discoveredFromUrl, pdf.sizeBytes]
  );
}
