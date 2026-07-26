# University RAG Chatbot

An embeddable chat widget for university websites. Students ask about exams,
syllabus, news, fees, admissions — in Hindi, English, or Hinglish — and get
accurate answers grounded in the university's own website content (RAG).

Built to become a **multi-tenant product**: one deployment serving many
universities, each a paying client with their own branded widget.

---

## The two rules that govern every decision

**1. Node.js is the primary language.** All business logic, state, API,
admin, crawler, workers, and orchestration are Node/TypeScript. Python
exists in exactly ONE place — `/extractor` — and does exactly ONE job:
PDF → structured JSON. Never add DB access, tenant logic, crawling, or any
new responsibility to the Python side. If a task can be done reasonably in
Node, do it in Node. The moment Python owns a second job, this rule has been
violated — stop and reconsider.

**2. `tenant_id` is threaded through everything from day one.** Every chunk,
crawl record, config row, and query log carries a `tenant_id` (university
identifier), even while there is only one tenant. Retrieval ALWAYS filters
by tenant server-side. The widget never decides which tenant's data is
searched — the backend resolves it from the tenant key and validates the
request Origin. A student at University A must have zero path to University
B's data, enforced in the backend, never the client.

---

## Stack (settled — do not relitigate; see docs/DECISIONS.md for the why)

- **API:** Fastify (Node/TypeScript)
- **Admin dashboard:** Next.js (or AdminJS for quick CRUD over Postgres)
- **Widget:** vanilla JS, single embeddable `<script>`, <10KB, no framework
- **Crawler:** Crawlee (Node), Playwright under it for JS-heavy pages
- **Workers / queue:** BullMQ on Redis
- **PDF extraction:** Python in `/extractor` (pdfplumber + Tesseract for
  scanned Hindi notices). Default fast path is `pdftotext -layout` (poppler,
  a C++ binary) called from Node; the Python service handles table-heavy PDFs.
- **Embeddings:** bge-m3 served by Ollama over HTTP (`/api/embed`).
  Called from Node via fetch — no Python in the embedding path.
- **Generation LLM:** Qwen 2.5 7B via Ollama (self-hosted) OR Claude API
  (Haiku) — chosen PER TENANT via a `llm_provider` config field, behind a
  single abstraction in the Node code so swapping is a config change.
- **Vector store + DB:** PostgreSQL + pgvector (one database for vectors,
  tenants, configs, users, usage logs — tenant filtering is plain SQL).
- **Deployment:** Docker Compose (postgres, redis, ollama, api, extractor,
  workers) on a single VPS. NO Kubernetes — wrong scale.

## Two choices that are expensive to reverse — treat with care

- **Embedding model (bge-m3):** changing it means re-embedding EVERYTHING.
  Vectors from different models are not comparable.
- **Chunking scheme:** changing it means re-processing everything. Split by
  heading/section, 200–500 words, slight overlap between chunks.

Everything else (vector DB, LLM, web framework) can be swapped in an
afternoon if code stays modular. Keep swap-expensive things behind interfaces.

## The Python boundary (the one hybrid rule that matters most)

`/extractor` is a frozen specialist. Contract: **PDF bytes in → JSON out**
(`{ pages: [...], tables: [...], text: "..." }`). It touches no database,
holds no state, knows nothing about tenants, chunks, or embeddings. Node
sends a file (child_process for MVP, HTTP microservice once containerized)
and does everything else with the result. It is protected by golden-file
tests (`/extractor/tests/golden/`): real university PDFs committed alongside
their expected JSON. Any change to the extractor must keep the goldens
passing — that is the safety rail, since the maintainer does not read Python
closely.

## Debugging heuristic (the boundary is a feature)

Bad answer → inspect the stored chunk. Chunk text garbled → extractor's
fault, check its JSON directly. Chunk fine but wrong one retrieved → Node
retrieval side. Narrow interfaces turn debugging into a binary search.

## Conventions

- TypeScript everywhere on the Node side; strict mode on.
- Commit to git after each working piece — cheap checkpoints, easy rollback.
- Store crawl provenance per chunk: source URL, page title, crawled-at
  timestamp. Enables citations, staleness expiry, and dispute resolution.
- Never trust client input for tenant identity or for which data to search.
- Rate-limit and cap queries per tenant (protects budget and other tenants).

## Current phase

Building the single-tenant MVP — but WITH `tenant_id` columns and the
config-driven crawler already in place (cheap now, expensive to retrofit).
Defer per-tenant theming, LLM routing, usage dashboards, and the HTTP
extractor service until university #2 is signed. See docs/ROADMAP.md.
