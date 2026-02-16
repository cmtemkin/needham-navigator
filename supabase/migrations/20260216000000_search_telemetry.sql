-- Migration: Search Telemetry Table
-- Created: 2026-02-16
-- Description: Server-side search quality telemetry for RAG pipeline monitoring

-- Create search_telemetry table
CREATE TABLE IF NOT EXISTS search_telemetry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  query text NOT NULL,
  was_decomposed boolean DEFAULT false,
  sub_query_count int DEFAULT 1,
  intents text[],                    -- array of QueryIntent values for all sub-queries
  source_hints text[],               -- array of SourceType values from all sub-queries
  result_count int,                  -- number of chunks returned
  top_similarity float,              -- highest similarity score
  avg_similarity float,              -- average similarity across results
  used_reranker boolean DEFAULT false,  -- whether Cohere reranker was used
  reranker_latency_ms int,          -- time spent in reranker (null if not used)
  total_latency_ms int,             -- total query time
  had_ai_answer boolean,            -- whether an AI answer was generated
  confidence text,                  -- confidence level (high/medium/low)
  created_at timestamptz DEFAULT now(),
  town text DEFAULT 'needham'
);

-- Enable RLS
ALTER TABLE search_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow inserts from API (no auth required — this is telemetry)
CREATE POLICY "Allow inserts" ON search_telemetry FOR INSERT WITH CHECK (true);

-- Allow admin reads (for analytics dashboard)
CREATE POLICY "Allow admin reads" ON search_telemetry FOR SELECT USING (true);

-- Indexes for common queries
CREATE INDEX idx_telemetry_created ON search_telemetry(created_at DESC);
CREATE INDEX idx_telemetry_intent ON search_telemetry USING GIN(intents);
CREATE INDEX idx_telemetry_source_hints ON search_telemetry USING GIN(source_hints);
CREATE INDEX idx_telemetry_town ON search_telemetry(town);
CREATE INDEX idx_telemetry_decomposed ON search_telemetry(was_decomposed);

-- Comment
COMMENT ON TABLE search_telemetry IS 'Server-side search quality metrics for RAG pipeline monitoring and optimization';
