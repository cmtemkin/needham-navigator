-- Needham Navigator — Initial Database Schema
-- Run this in Supabase SQL Editor to set up the database.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- Towns (multi-tenant root table)
-- ============================================================
CREATE TABLE towns (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  website_url TEXT,
  brand_colors JSONB DEFAULT '{}',
  config     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the first town
INSERT INTO towns (id, name, website_url) VALUES
  ('needham', 'Needham, MA', 'https://www.needhamma.gov');

-- ============================================================
-- Documents
-- ============================================================
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  town_id          TEXT NOT NULL REFERENCES towns(id),
  url              TEXT NOT NULL,
  title            TEXT,
  source_type      TEXT CHECK (source_type IN ('pdf', 'html')),
  content_hash     TEXT,
  file_size_bytes  INT,
  downloaded_at    TIMESTAMPTZ,
  last_ingested_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  is_stale         BOOLEAN DEFAULT false,
  chunk_count      INT DEFAULT 0,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(town_id, url)
);

CREATE INDEX idx_documents_town ON documents(town_id);
CREATE INDEX idx_documents_stale ON documents(is_stale) WHERE is_stale = true;

-- ============================================================
-- Document Chunks (with pgvector embeddings)
-- ============================================================
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  town_id       TEXT NOT NULL REFERENCES towns(id),
  chunk_index   INT NOT NULL,
  chunk_text    TEXT NOT NULL,
  embedding     vector(1536),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_town ON document_chunks(town_id);

-- HNSW index for fast vector similarity search
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- Departments
-- ============================================================
CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  town_id     TEXT NOT NULL REFERENCES towns(id),
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  hours       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_departments_town ON departments(town_id);

-- ============================================================
-- Conversations (anonymous session tracking)
-- ============================================================
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  town_id    TEXT NOT NULL REFERENCES towns(id),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_conversations_town ON conversations(town_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);

-- ============================================================
-- Feedback
-- ============================================================
CREATE TABLE feedback (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id    UUID REFERENCES conversations(id),
  response_text_hash TEXT,
  helpful            BOOLEAN,
  comment            TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feedback_conversation ON feedback(conversation_id);

-- ============================================================
-- Ingestion Log
-- ============================================================
CREATE TABLE ingestion_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  town_id             TEXT NOT NULL REFERENCES towns(id),
  action              TEXT CHECK (action IN ('crawl', 'parse', 'embed', 'monitor')),
  documents_processed INT DEFAULT 0,
  errors              INT DEFAULT 0,
  duration_ms         INT,
  details             JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ingestion_log_town ON ingestion_log(town_id);
CREATE INDEX idx_ingestion_log_action ON ingestion_log(action);

-- ============================================================
-- Row-Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE towns ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_log ENABLE ROW LEVEL SECURITY;

-- Public read access policies (anon key can read)
CREATE POLICY "Public can read towns"
  ON towns FOR SELECT USING (true);

CREATE POLICY "Public can read documents"
  ON documents FOR SELECT USING (true);

CREATE POLICY "Public can read chunks"
  ON document_chunks FOR SELECT USING (true);

CREATE POLICY "Public can read departments"
  ON departments FOR SELECT USING (true);

-- Public can create conversations and feedback
CREATE POLICY "Public can create conversations"
  ON conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read own conversations"
  ON conversations FOR SELECT USING (true);

CREATE POLICY "Public can create feedback"
  ON feedback FOR INSERT WITH CHECK (true);

-- Service role (service key) has full access via default Supabase behavior.
-- These policies only restrict the anon key.

-- Write policies for service role on data tables
CREATE POLICY "Service can manage documents"
  ON documents FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage chunks"
  ON document_chunks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage departments"
  ON departments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage ingestion_log"
  ON ingestion_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Semantic search function
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_town_id   TEXT,
  match_threshold  FLOAT DEFAULT 0.7,
  match_count      INT DEFAULT 10
)
RETURNS TABLE (
  id         UUID,
  chunk_text TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.chunk_text,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.town_id = match_town_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
