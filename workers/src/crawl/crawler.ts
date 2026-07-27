import { CheerioCrawler } from "crawlee";
import { chunkText } from "../ingest/chunk.js";
import { embed } from "../ingest/embed.js";
import { upsertChunks } from "../ingest/upsert.js";

export interface CrawlConfig {
  tenantId: string;
  baseUrl: string;
  allowedPaths: string[];
  selectors: Record<string, string>;
  maxRequestsPerCrawl?: number;
}

/** Onboarding a university = insert a crawl_configs row, not writing a new spider. */
export async function crawlTenant(config: CrawlConfig): Promise<void> {
  const contentSelector = config.selectors.content ?? "main, article, body";

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: config.maxRequestsPerCrawl ?? 50,
    async requestHandler({ request, $, enqueueLinks }) {
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
    },
  });

  await crawler.run([config.baseUrl]);
}
