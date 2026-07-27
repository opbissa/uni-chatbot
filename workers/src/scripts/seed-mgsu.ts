import { pool } from "../db/pool.js";
import { crawlTenant } from "../crawl/crawler.js";

const TENANT_KEY = "demo-tenant";
const BASE_URL = "https://www.mgsubikaner.ac.in";
const ALLOWED_PATHS = [
  "/notification/examination*",
  "/notification/admission*",
  "/notification/student-update*",
  "/syllabus*",
  "/fee-structure*",
  "/acadmic-calendar*",
  "/course-programmes*",
];

async function main() {
  const { rows } = await pool.query(
    `INSERT INTO tenants (name, tenant_key, domains, llm_provider)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_key) DO UPDATE SET domains = EXCLUDED.domains
     RETURNING id`,
    ["Maharaja Ganga Singh University", TENANT_KEY, ["localhost"], "ollama"]
  );
  const tenantId: string = rows[0].id;
  console.log(`tenant ${tenantId}`);

  await pool.query(
    `INSERT INTO crawl_configs (tenant_id, base_url, allowed_paths, selectors)
     VALUES ($1, $2, $3, $4)`,
    [tenantId, BASE_URL, ALLOWED_PATHS, { content: "section.Deans" }]
  );

  await crawlTenant({
    tenantId,
    baseUrl: BASE_URL,
    allowedPaths: ALLOWED_PATHS,
    selectors: { content: "section.Deans" },
    maxRequestsPerCrawl: 50,
  });

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
