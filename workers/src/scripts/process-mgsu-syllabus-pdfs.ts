import "../env.js";
import * as cheerio from "cheerio";
import { pool } from "../db/pool.js";
import { processPdfUrl } from "../ingest/processPdf.js";
import { insertPendingPdf } from "../ingest/pdfDocuments.js";

const TENANT_KEY = "demo-tenant";
const SYLLABUS_PAGE_URL = "https://www.mgsubikaner.ac.in/syllabus";
// The syllabus page also links ~500 unrelated site-wide PDFs (affiliation
// rules, alumni rules, convener lists) that appear in the same sidebar on
// every page of the site. Only links under /PDF/syllabus<year>/ are actual
// syllabus documents.
const SYLLABUS_PDF_PATH = /\/PDF\/syllabus\d+\//i;
const PDF_SIZE_THRESHOLD_BYTES = Number(process.env.PDF_SIZE_THRESHOLD_BYTES) || 2 * 1024 * 1024;

async function getPdfSizeBytes(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

async function main() {
  const { rows } = await pool.query(`SELECT id FROM tenants WHERE tenant_key = $1`, [TENANT_KEY]);
  if (rows.length === 0) throw new Error(`tenant not found: ${TENANT_KEY}`);
  const tenantId: string = rows[0].id;

  const pageRes = await fetch(SYLLABUS_PAGE_URL);
  if (!pageRes.ok) throw new Error(`fetch failed for ${SYLLABUS_PAGE_URL}: ${pageRes.status}`);
  const $ = cheerio.load(await pageRes.text());

  const pdfUrls = new Set<string>();
  $('a[href$=".pdf" i]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: string;
    try {
      absolute = new URL(href, SYLLABUS_PAGE_URL).toString();
    } catch {
      return;
    }
    if (SYLLABUS_PDF_PATH.test(absolute)) pdfUrls.add(absolute);
  });

  console.log(`found ${pdfUrls.size} syllabus PDFs`);

  let processed = 0;
  let queued = 0;
  let failed = 0;

  for (const pdfUrl of pdfUrls) {
    const linkText = $(`a[href$=".pdf" i]`)
      .filter((_, el) => {
        const href = $(el).attr("href");
        return !!href && new URL(href, SYLLABUS_PAGE_URL).toString() === pdfUrl;
      })
      .first()
      .text()
      .trim() || null;

    try {
      const sizeBytes = await getPdfSizeBytes(pdfUrl);
      if (sizeBytes === null || sizeBytes > PDF_SIZE_THRESHOLD_BYTES) {
        await insertPendingPdf({
          tenantId,
          sourceUrl: pdfUrl,
          linkText,
          discoveredFromUrl: SYLLABUS_PAGE_URL,
          sizeBytes,
        });
        queued++;
        console.log(`queued for review (size ${sizeBytes ?? "unknown"}): ${pdfUrl}`);
        continue;
      }

      await processPdfUrl(tenantId, pdfUrl, linkText);
      processed++;
      console.log(`processed: ${pdfUrl}`);
    } catch (err) {
      failed++;
      console.error(`failed: ${pdfUrl}: ${(err as Error).message}`);
    }
  }

  console.log(`done. processed=${processed} queued=${queued} failed=${failed}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
