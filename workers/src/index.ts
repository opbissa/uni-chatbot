import { Worker } from "bullmq";
import { connection, type CrawlJobData, type PdfIngestJobData } from "./queue.js";
import { crawlTenant } from "./crawl/crawler.js";
import { processPdfUrl } from "./ingest/processPdf.js";
import { pool } from "./db/pool.js";

const worker = new Worker<CrawlJobData>(
  "crawl",
  async (job) => {
    const { rows } = await pool.query(
      `SELECT tenant_id, base_url, allowed_paths, selectors
       FROM crawl_configs WHERE id = $1`,
      [job.data.crawlConfigId]
    );
    if (rows.length === 0) throw new Error(`crawl_config ${job.data.crawlConfigId} not found`);

    const row = rows[0];
    await crawlTenant({
      tenantId: row.tenant_id,
      baseUrl: row.base_url,
      allowedPaths: row.allowed_paths,
      selectors: row.selectors,
    });
  },
  { connection }
);

worker.on("completed", (job) => console.log(`crawl job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`crawl job ${job?.id} failed`, err));

const pdfWorker = new Worker<PdfIngestJobData>(
  "pdf-ingest",
  async (job) => {
    const { rows } = await pool.query(
      `SELECT tenant_id, source_url, link_text, status FROM pdf_documents WHERE id = $1`,
      [job.data.pdfDocumentId]
    );
    if (rows.length === 0) throw new Error(`pdf_document ${job.data.pdfDocumentId} not found`);

    const row = rows[0];
    // Admin may have re-rejected it after the job was enqueued; don't process a non-approved row.
    if (row.status !== "approved") return;

    try {
      await processPdfUrl(row.tenant_id, row.source_url, row.link_text);
      await pool.query(`UPDATE pdf_documents SET status = 'processed', processed_at = now() WHERE id = $1`, [
        job.data.pdfDocumentId,
      ]);
    } catch (err) {
      await pool.query(`UPDATE pdf_documents SET status = 'failed' WHERE id = $1`, [job.data.pdfDocumentId]);
      throw err;
    }
  },
  { connection }
);

pdfWorker.on("completed", (job) => console.log(`pdf-ingest job ${job.id} completed`));
pdfWorker.on("failed", (job, err) => console.error(`pdf-ingest job ${job?.id} failed`, err));
