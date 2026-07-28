import "../env.js";
import { pool } from "../db/pool.js";
import { crawlTenant } from "../crawl/crawler.js";

const TENANT_KEY = "demo-tenant";
const BASE_URL = "https://www.mgsubikaner.ac.in";

async function main() {
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE tenant_key = $1`, [TENANT_KEY]);
  if (rows.length === 0) throw new Error(`tenant ${TENANT_KEY} not found`);
  const tenantId: string = rows[0].id;

  await crawlTenant({
    tenantId,
    baseUrl: BASE_URL,
    allowedPaths: [],
    selectors: { content: "main, article, body" },
    maxRequestsPerCrawl: 1,
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
