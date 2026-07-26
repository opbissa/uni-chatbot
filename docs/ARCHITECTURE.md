# Architecture

## Data flow

### Ingestion (runs on a schedule, per tenant)
```
Crawlee crawler (Node)
   → fetches HTML pages + downloads PDFs for one tenant
   → HTML parsed with Cheerio; PDFs sent to extraction
        · fast path: pdftotext -layout (poppler, from Node)
        · fallback:  /extractor Python service (table-heavy / scanned)
   → chunk text (split by heading, 200–500 words, slight overlap)  [Node]
   → embed each chunk via Ollama /api/embed (bge-m3)               [Node→HTTP]
   → upsert into pgvector with tenant_id + provenance              [Node→SQL]
```

### Query (real time)
```
Widget (tenant key + Origin) → Fastify API
   → resolve tenant_id from key; validate Origin against tenant domains
   → embed the question via Ollama (bge-m3)
   → pgvector similarity search  WHERE tenant_id = $1  (top-k, e.g. 5)
   → assemble prompt: system + retrieved chunks + question
   → generate via tenant's llm_provider (Qwen/Ollama OR Claude Haiku)
   → stream answer back to widget, with source citations
   → log query (tenant_id, timestamp, sources, token counts) for billing
```

## Repo layout
```
uni-chatbot/
├── CLAUDE.md              # stack decisions + the two governing rules
├── docs/
│   ├── DECISIONS.md       # why each choice, with alternatives
│   ├── ARCHITECTURE.md    # this file
│   └── ROADMAP.md         # what's MVP vs deferred to tenant #2
├── api/                   # Fastify — routes, tenant resolution, RAG orchestration
│   ├── src/
│   │   ├── rag/           # retrieve + prompt assembly + generation
│   │   ├── llm/           # provider abstraction (ollama.ts, claude.ts)
│   │   ├── tenants/       # tenant resolution, origin validation
│   │   └── db/            # pgvector queries, migrations
├── admin/                 # Next.js / AdminJS dashboard
├── widget/                # vanilla JS embeddable script (<10KB)
├── workers/               # BullMQ — crawl + ingest jobs (Crawlee lives here)
├── extractor/             # THE Python part — PDF → JSON, nothing else
│   ├── extract.py
│   ├── requirements.txt   # pinned exact versions
│   └── tests/golden/      # sample PDFs + expected JSON output
└── docker-compose.yml     # postgres, redis, ollama, api, extractor, workers
```

## Multi-tenant data model (essentials)

Every content and log table carries `tenant_id`. Core tables:

- **tenants** — id, name, registered domains (for Origin validation),
  llm_provider (`ollama` | `claude`), plan, monthly query cap, theming
  (colors, logo URL, welcome message, default language).
- **crawl_configs** — tenant_id, base URL, allowed paths, per-section CSS
  selectors, schedule, language hints. Onboarding a university = insert a row
  here + trigger a crawl. NOT writing a new spider.
- **chunks** — id, tenant_id, embedding (vector), text, source_url,
  page_title, crawled_at. The `tenant_id` column is indexed and every query
  filters on it.
- **query_logs** — tenant_id, timestamp, question, retrieved_source_ids,
  input_tokens, output_tokens. Drives billing, cost visibility, and the
  "what students asked" dashboard.

## Security invariants (never violate)

1. `tenant_id` for a request is resolved server-side from the tenant key,
   never accepted from the client body.
2. Every retrieval query filters by that resolved `tenant_id`.
3. Request Origin is validated against the tenant's registered domains
   (stops other sites freeloading on a client's quota).
4. Per-tenant rate limits and monthly caps enforced in the API layer.

## The extractor contract

```
Input:  PDF bytes (+ optional hint: "tables" | "scanned")
Output: { pages: [{ n, text }], tables: [[...rows]], text: "full text" }
```
No DB, no state, no tenant awareness. Invoked by Node via child_process
(MVP) or HTTP (once containerized). Changes must keep golden tests passing.
