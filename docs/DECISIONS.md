# Architecture Decisions

Why each layer is what it is, and what the alternatives were. Read this
before proposing a stack change — most of these were deliberate, and the
tradeoffs are recorded so we don't relitigate them mid-build.

## Language split: Node primary, Python quarantined

The maintainer is strong in Node.js and weak in Python. The right stack is
the one its maintainer can debug confidently in a production incident, not
the one that's marginally better on paper. So: Node owns all living logic;
Python is allowed only where its advantage is large AND the code rarely
changes once working.

Applying that test to the two Python candidates:

- **PDF extraction** — LARGE Python advantage (pdfplumber table extraction
  has no real Node equivalent), and it's frozen converter code. → Python. ✅
- **Crawling** — SMALL Python advantage (Scrapy leads Crawlee only at
  large-scale hardening we'll never exercise on ~1000-page daily crawls),
  and it's living logic edited on every new university. → Node. ✅

The candidates fail opposite tests, which is why one is Python and one is
Node. If a task's Python advantage is small OR the code changes often, it
stays in Node.

## API: Fastify (Node)

Alternatives: Express, FastAPI (Python), Django, NestJS.
- FastAPI/Django rejected on the language rule — would force a Python
  service to maintain.
- Express is fine; Fastify chosen for better native async ergonomics,
  built-in schema validation, and first-class streaming (needed for the
  typewriter effect in the widget).
- NestJS is heavier structure than a solo operator needs here.

## Admin: Next.js / AdminJS (Node)

Alternatives: Django admin (Python), Retool/paid, custom React.
- Django admin was the ONE thing pulling toward Python for multi-tenant.
  Going Node removes that tension — build the dashboard in JS anyway.
- AdminJS gives near-free CRUD over Postgres tables for the MVP; graduate to
  a custom Next.js dashboard when the tenant-facing analytics view matters.

## Crawler: Crawlee (Node)

Alternatives: Scrapy (Python), BeautifulSoup+requests, Playwright alone,
Firecrawl (paid).
- Scrapy leads only at million-page scale (scheduler, autothrottle, resumable
  jobs). Our scale is hundreds–thousands of pages, once daily — that
  advantage never gets exercised.
- Crawler is living logic tightly coupled to Node workers/config — belongs in
  the primary language.
- Both Crawlee and Scrapy drive Playwright for JS-heavy pages, so that case
  is a tie. Cheerio replaces BeautifulSoup for static HTML.
- Firecrawl rejected: paid API, breaks self-hosting goal.
- Exception to revisit only if a specific university needs aggressive
  anti-bot evasion — then that ONE tenant's crawler might justify Scrapy.
  Don't architect for it now.

## PDF extraction: Python (pdfplumber) — the one quarantined service

Alternatives considered for staying in Node: pdf-parse, pdfjs-dist,
`pdftotext -layout` (poppler).
- Node PDF libs discard layout — date-sheet tables come out scrambled. This
  is the most important pipeline stage (garbage here = garbage answers), so
  quality wins.
- Default fast path is still `pdftotext -layout` (poppler C++ binary, called
  from Node) — handles ~80% of PDFs with columns intact, no Python needed.
- The Python service is the fallback for table-heavy PDFs only.
- Scanned Hindi notices → Tesseract (a binary; `node-tesseract-ocr` wraps it,
  so OCR itself is language-neutral).

## Embeddings: bge-m3 via Ollama HTTP

Alternatives: multilingual-e5-large, Jina, MiniLM variants, paid APIs
(Voyage/OpenAI/Cohere), Transformers.js in-process.
- Binding constraint: Hindi + English in one vector space. Eliminates
  English-only models.
- bge-m3 edges e5-large on multilingual retrieval and handles long chunks
  (8K tokens vs 512) — matters for long notification pages.
- Served by Ollama over HTTP, NOT run in Python in-process. This is the key
  trick that keeps the embedding path out of Python: Node just POSTs to
  `localhost:11434/api/embed`. Removes the biggest reason RAG stacks default
  to Python.
- Transformers.js (ONNX in Node) exists but is slower/fiddlier — Ollama route
  is cleaner.
- EXPENSIVE TO CHANGE: switching models = re-embed everything.

## Generation: Qwen 2.5 7B (Ollama) or Claude Haiku (API), per tenant

Alternatives: Llama 3.1 8B, Mistral 7B, Gemma 2 9B, Indian models
(Sarvam, Krutrim).
- Qwen chosen for unusually strong Hindi at 7B; Llama/Mistral weaker at Hindi.
- Indian-built models worth benchmarking on real student queries if Hindi
  quality disappoints — tooling/availability varies.
- Behind a single abstraction, so model swap = one-line config change. The
  open-model leaderboard shifts every few months; re-check periodically.
- Per-tenant routing is a commercial lever: small college on Haiku API
  (~100 queries/day, cheap), big university wanting on-premise gets
  self-hosted Qwen at a higher price tier. Same codebase.

### Rough cost anchor (verify current pricing before quoting clients)
As of mid-2026, Claude Haiku API ran ~$1/$5 per million input/output tokens.
A typical RAG query (~2,500 input + ~250 output tokens) cost roughly
$0.004 (~₹0.30) — about 3 queries per rupee. A self-hosted GPU box
(~₹15–25k/month) only breaks even against Haiku somewhere around
1,500–2,000 sustained queries/day. Below that, API is cheaper AND less to
operate. Re-check current model names and prices — they move.

## Vector store + DB: PostgreSQL + pgvector

Alternatives: Qdrant, Chroma, Milvus, Weaviate, FAISS, Pinecone.
- At our scale (a few thousand chunks per tenant) ANY of these works —
  the differentiator is operations, not capability.
- Multi-tenant needs Postgres anyway (tenants, users, configs, usage logs).
  Putting vectors in the same Postgres = one datastore, transactional
  consistency, tenant filtering as plain SQL (`WHERE tenant_id = $1`).
- Qdrant was the single-tenant MVP pick (trivial setup, clean filtering) but
  consolidating on pgvector avoids running two datastores as a solo operator.
- Milvus/Weaviate built for 100M+ vectors — infra burden for capacity we'll
  never use. Pinecone is paid/managed. Chroma great for prototyping, less
  production-mature.

## Widget: vanilla JS

Alternatives: React, Vue, Svelte, Preact.
- Must embed on someone else's site with one script tag, tiny and
  conflict-free. React bundle (~40KB+) is an ecosystem commitment for what is
  a styled div with a message list. Vanilla keeps it <10KB.
- Upgrade path if it grows complex (file uploads, rich cards): Preact/Svelte
  (small compiled bundles), not React.

## Workers: BullMQ (Node/Redis)

Alternatives: Celery (Python), RQ, plain cron.
- Celery rejected on language rule. BullMQ is the Node-native equivalent on
  the same Redis. Plain cron is fine for the very first crawl loop; graduate
  to BullMQ when crawls become per-tenant scheduled jobs.

## Deployment: Docker Compose on one VPS

Alternatives: Kubernetes, serverless, bare metal.
- A RAG query is mostly waiting on the LLM, not CPU-bound. One decent VPS
  serves the first 10–20 tenants. K8s is complexity for a scale problem we
  don't have.
- Non-negotiable once there are paying tenants: automated Postgres backups
  (embeddings + configs ARE the product) and basic monitoring/alerting
  (a bot answering from a stale syllabus is worse than no bot).
