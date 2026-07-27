import { CheerioCrawler } from "crawlee";
import { chunkText } from "../ingest/chunk.js";
import { embed } from "../ingest/embed.js";
import { upsertChunks } from "../ingest/upsert.js";
import { processPdfUrl } from "../ingest/processPdf.js";
import { insertPendingPdf } from "../ingest/pdfDocuments.js";

const DEFAULT_PDF_SIZE_THRESHOLD_BYTES = Number(process.env.PDF_SIZE_THRESHOLD_BYTES) || 2 * 1024 * 1024;

export interface CrawlConfig {
  tenantId: string;
  baseUrl: string;
  allowedPaths: string[];
  selectors: Record<string, string>;
  maxRequestsPerCrawl?: number;
  maxPdfsPerCrawl?: number;
  pdfSizeThresholdBytes?: number;
}

/** HEAD request for Content-Length; null (unknown size) means "needs review", not "assume small". */
async function getPdfSizeBytes(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

/** Onboarding a university = insert a crawl_configs row, not writing a new spider. */
export async function crawlTenant(config: CrawlConfig): Promise<void> {
  const contentSelector = config.selectors.content ?? "main, article, body";
  const maxPdfs = config.maxPdfsPerCrawl ?? 20;
  const pdfSizeThreshold = config.pdfSizeThresholdBytes ?? DEFAULT_PDF_SIZE_THRESHOLD_BYTES;
  const baseOrigin = new URL(config.baseUrl).origin;
  const seenPdfUrls = new Set<string>();

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: config.maxRequestsPerCrawl ?? 50,
    // Default (60s) is too short once a page has PDF links: fetching and
    // extracting each one (possibly via OCR) can take a while. A handler
    // that "times out" here doesn't actually get cancelled — Crawlee just
    // retries while the original invocation keeps running, so a short
    // timeout causes duplicate upserts from overlapping retries, not just
    // slowness.
    requestHandlerTimeoutSecs: 300,
    async requestHandler({ request, $, enqueueLinks, log }) {
      const pageTitle = $("title").first().text().trim() || null;
      const text = $(contentSelector).first().text().replace(/\s+/g, " ").trim();

      if (text) {
        const chunks = chunkText(text);
        const embeddings = await Promise.all(chunks.map((c) => embed(c.text)));
        await upsertChunks(config.tenantId, chunks, { sourceUrl: request.url, pageTitle }, embeddings);
      }

      await enqueueLinks({
        globs: config.allowedPaths.map((p) => `${config.baseUrl}${p}`),
      });

      // PDFs live all over a university's document library (e.g. /PDF/*),
      // not under the page's own allowedPaths glob, so scope them by
      // same-origin instead and cap the count per crawl run.
      const pdfLinks = $('a[href$=".pdf" i]')
        .map((_, el) => ({ href: $(el).attr("href"), text: $(el).text().trim() }))
        .get()
        .filter((l): l is { href: string; text: string } => Boolean(l.href));

      for (const { href, text: linkText } of pdfLinks) {
        if (seenPdfUrls.size >= maxPdfs) break;

        let pdfUrl: string;
        try {
          pdfUrl = new URL(href, request.url).toString();
        } catch {
          continue;
        }
        if (new URL(pdfUrl).origin !== baseOrigin || seenPdfUrls.has(pdfUrl)) continue;
        seenPdfUrls.add(pdfUrl);

        try {
          const sizeBytes = await getPdfSizeBytes(pdfUrl);
          if (sizeBytes === null || sizeBytes > pdfSizeThreshold) {
            await insertPendingPdf({
              tenantId: config.tenantId,
              sourceUrl: pdfUrl,
              linkText: linkText || null,
              discoveredFromUrl: request.url,
              sizeBytes,
            });
            continue;
          }

          await processPdfUrl(config.tenantId, pdfUrl, linkText || null);
        } catch (err) {
          log.warning(`PDF ingest failed for ${pdfUrl}: ${(err as Error).message}`);
        }
      }
    },
  });

  await crawler.run([config.baseUrl]);
}
