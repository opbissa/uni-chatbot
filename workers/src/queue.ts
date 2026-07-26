import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export interface CrawlJobData {
  tenantId: string;
  crawlConfigId: string;
}

export const crawlQueue = new Queue<CrawlJobData>("crawl", { connection });

export { connection };
