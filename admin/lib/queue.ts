import { Queue } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

export interface PdfIngestJobData {
  pdfDocumentId: string;
}

export const pdfIngestQueue = new Queue<PdfIngestJobData>("pdf-ingest", { connection });
