import { pool } from "../db/pool.js";
import { crawlTenant } from "../crawl/crawler.js";

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error("usage: test-pdf-crawl.ts <tenantId>");
  process.exit(1);
}

async function main() {
  await crawlTenant({
    tenantId: TENANT_ID,
    baseUrl: "https://www.mgsubikaner.ac.in",
    allowedPaths: [],
    selectors: { content: "section.Deans" },
    maxRequestsPerCrawl: 1,
    maxPdfsPerCrawl: 5,
    pdfSizeThresholdBytes: 1,
  });
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
