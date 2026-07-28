-- Every content and log table carries tenant_id from day one.
-- See docs/ARCHITECTURE.md "Multi-tenant data model".

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  tenant_key     text NOT NULL UNIQUE, -- given to the widget embed snippet
  domains        text[] NOT NULL DEFAULT '{}', -- for Origin validation
  llm_provider   text NOT NULL DEFAULT 'ollama', -- 'ollama' | 'claude' | 'gemini'
  plan           text NOT NULL DEFAULT 'free',
  monthly_query_cap integer NOT NULL DEFAULT 1000,
  theme          jsonb NOT NULL DEFAULT '{}', -- colors, logo URL, welcome message
  default_language text NOT NULL DEFAULT 'en',
  -- widget-side chat history persistence (localStorage), per tenant
  chat_history_limit        integer NOT NULL DEFAULT 50, -- max messages kept client-side
  chat_history_expiry_hours integer NOT NULL DEFAULT 720, -- 30 days
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crawl_configs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  base_url       text NOT NULL,
  allowed_paths  text[] NOT NULL DEFAULT '{}',
  selectors      jsonb NOT NULL DEFAULT '{}', -- per-section CSS selectors
  schedule       text NOT NULL DEFAULT '0 3 * * *', -- cron, default daily 3am
  language_hint  text,
  -- PDFs at or under this size auto-process; larger ones (or unknown size,
  -- e.g. no Content-Length on HEAD) wait in pdf_documents for admin review.
  pdf_size_threshold_bytes bigint NOT NULL DEFAULT 2097152, -- 2MB
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crawl_configs_tenant_id_idx ON crawl_configs(tenant_id);

-- PDFs discovered while crawling that are too large (or unknown size) to
-- auto-process. Reviewed via the admin approval screen; approving one
-- enqueues a pdf-ingest job that runs the same extract/chunk/embed path
-- the crawler uses for small PDFs and HTML pages.
CREATE TABLE IF NOT EXISTS pdf_documents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_url           text NOT NULL,
  link_text            text,
  discovered_from_url  text,
  size_bytes           bigint, -- null when Content-Length was unavailable
  status               text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'processed' | 'failed'
  discovered_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  processed_at         timestamptz,
  UNIQUE (tenant_id, source_url)
);
CREATE INDEX IF NOT EXISTS pdf_documents_tenant_status_idx ON pdf_documents(tenant_id, status);

-- bge-m3 embedding dimension = 1024
CREATE TABLE IF NOT EXISTS chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  embedding      vector(1024) NOT NULL,
  text           text NOT NULL,
  source_url     text NOT NULL,
  page_title     text,
  crawled_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_tenant_id_idx ON chunks(tenant_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS query_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question            text NOT NULL,
  retrieved_source_ids uuid[] NOT NULL DEFAULT '{}',
  input_tokens        integer,
  output_tokens       integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS query_logs_tenant_id_idx ON query_logs(tenant_id);
