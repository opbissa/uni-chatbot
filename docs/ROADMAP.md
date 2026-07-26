# Roadmap

Guiding principle: build the single-tenant MVP, but bake in the
multi-tenant decisions that are cheap now and expensive to retrofit.
Defer everything tenant-facing until university #2 is actually signed.

## Do NOW (cheap now, expensive later)
- `tenant_id` column on every content/log table, even with one tenant.
- Config-driven crawler: crawl settings live in a `crawl_configs` row, not
  hardcoded in a spider.
- LLM provider abstraction (`api/src/llm/`) with Ollama as the first impl,
  so per-tenant routing later is a config change, not a refactor.
- Crawl provenance per chunk (source_url, page_title, crawled_at).
- Server-side tenant resolution + retrieval filtering from the start.

## MVP scope (one real university, end to end)
1. Crawler (Crawlee) for one university site → HTML + PDFs.
2. Extraction: `pdftotext -layout` fast path + `/extractor` Python fallback,
   with a handful of golden-file tests.
3. Chunking + embedding (Ollama/bge-m3) → pgvector.
4. Fastify query endpoint: retrieve → prompt → generate (Ollama/Qwen) →
   stream, with citations.
5. Vanilla JS widget, embeddable with one script tag.
6. Graceful "I don't know — contact the office" when retrieval is weak.
7. Handle Hindi / English / Hinglish queries.

## Defer until tenant #2
- Per-tenant widget theming (colors, logo, welcome message, language).
- Origin validation against registered domains.
- Per-tenant LLM routing (Claude Haiku vs self-hosted Qwen) + price tiers.
- Per-tenant rate limits and monthly query caps.
- Usage dashboard ("what students asked this month") — often the renewal
  driver for the university.
- Promote the extractor from child_process to an HTTP microservice in
  docker-compose.
- Automated Postgres backups + monitoring/alerting (non-negotiable ONCE
  there are paying tenants).

## Cross the bridge only if reached
- Scrapy for a single tenant needing aggressive anti-bot evasion.
- Reconsider LlamaIndex-style framework only if retrieval grows to need
  rerankers + query rewriting across many patterns.
- Preact/Svelte widget only if it grows rich UI (file uploads, cards).

## Sequencing note
Build MVP items 1→5 in order, committing to git after each works. Each stage
has a clean input/output, so a broken stage is isolated. Get one university
answering real questions before touching anything in "Defer".
