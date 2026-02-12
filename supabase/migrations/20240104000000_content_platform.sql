-- Migration 004: Content Platform tables
--
-- Adds the multi-source content aggregation layer:
--   content_items    — normalized items from all connectors (news, events, dining, etc.)
--   source_configs   — per-town connector registry
--   generated_content — AI-generated editorial (daily digests, summaries)

-- ============================================================================
-- content_items — unified table for all ingested content
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  url TEXT,
  image_url TEXT,
  metadata JSONB DEFAULT '{}',
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(town_id, source_id, content_hash)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_content_items_town_cat
  ON content_items(town_id, category);
CREATE INDEX IF NOT EXISTS idx_content_items_published
  ON content_items(town_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_source
  ON content_items(town_id, source_id);
CREATE INDEX IF NOT EXISTS idx_content_items_hash
  ON content_items(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_items_expires
  ON content_items(expires_at) WHERE expires_at IS NOT NULL;

-- Vector similarity search index (same parameters as document_chunks)
CREATE INDEX IF NOT EXISTS idx_content_items_embedding
  ON content_items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- JSONB index for metadata queries
CREATE INDEX IF NOT EXISTS idx_content_items_metadata
  ON content_items USING GIN (metadata);


-- ============================================================================
-- source_configs — connector registry (which sources are active per town)
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_configs (
  id TEXT PRIMARY KEY,
  town_id TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  category TEXT NOT NULL,
  schedule TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  should_embed BOOLEAN DEFAULT false,
  last_fetched_at TIMESTAMPTZ,
  last_error TEXT,
  error_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_configs_town
  ON source_configs(town_id);
CREATE INDEX IF NOT EXISTS idx_source_configs_enabled
  ON source_configs(town_id, enabled) WHERE enabled = true;


-- ============================================================================
-- generated_content — AI-generated editorial content
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_item_ids UUID[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_generated_content_town_type
  ON generated_content(town_id, type);
CREATE INDEX IF NOT EXISTS idx_generated_content_published
  ON generated_content(town_id, published_at DESC);


-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

-- Public read access scoped to town
CREATE POLICY "content_items_public_read" ON content_items
  FOR SELECT USING (town_id = current_setting('request.headers', true)::json->>'x-town-id');

CREATE POLICY "source_configs_public_read" ON source_configs
  FOR SELECT USING (town_id = current_setting('request.headers', true)::json->>'x-town-id');

CREATE POLICY "generated_content_public_read" ON generated_content
  FOR SELECT USING (town_id = current_setting('request.headers', true)::json->>'x-town-id');

-- Service role full access for ingestion
CREATE POLICY "content_items_service_all" ON content_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "source_configs_service_all" ON source_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "generated_content_service_all" ON generated_content
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================================
-- Semantic search function for content_items (mirrors match_documents)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_content_items(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_town_id text DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  town_id TEXT,
  source_id TEXT,
  category TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.town_id,
    ci.source_id,
    ci.category,
    ci.title,
    ci.content,
    ci.summary,
    ci.url,
    ci.published_at,
    ci.metadata,
    1 - (ci.embedding <=> query_embedding) AS similarity
  FROM content_items ci
  WHERE
    ci.embedding IS NOT NULL
    AND (filter_town_id IS NULL OR ci.town_id = filter_town_id)
    AND (filter_category IS NULL OR ci.category = filter_category)
    AND (ci.expires_at IS NULL OR ci.expires_at > NOW())
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY ci.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
