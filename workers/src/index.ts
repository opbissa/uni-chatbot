import { Worker } from "bullmq";
import { connection, type CrawlJobData } from "./queue.js";
import { crawlTenant } from "./crawl/crawler.js";
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
