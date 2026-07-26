-- Every content and log table carries tenant_id from day one.
-- See docs/ARCHITECTURE.md "Multi-tenant data model".

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  tenant_key     text NOT NULL UNIQUE, -- given to the widget embed snippet
  domains        text[] NOT NULL DEFAULT '{}', -- for Origin validation
  llm_provider   text NOT NULL DEFAULT 'ollama', -- 'ollama' | 'claude'
  plan           text NOT NULL DEFAULT 'free',
  monthly_query_cap integer NOT NULL DEFAULT 1000,
  theme          jsonb NOT NULL DEFAULT '{}', -- colors, logo URL, welcome message
  default_language text NOT NULL DEFAULT 'en',
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
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crawl_configs_tenant_id_idx ON crawl_configs(tenant_id);

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
