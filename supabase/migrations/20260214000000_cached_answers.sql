-- =====================================================================
-- Migration: Cached Answers Table
-- Date: 2026-02-14
-- Description: Create cached_answers table for storing pre-computed AI
--              answers to common queries. Speeds up search-mode UI by
--              serving instant answers for frequent questions.
--
-- IMPORTANT: This migration must be run manually against the Supabase
--            project via the SQL editor or CLI. It is NOT run automatically.
--
-- To apply:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Paste this file's contents
--   3. Click "Run"
-- =====================================================================

-- Cached AI answers for common queries
-- Speeds up search-mode UI by serving instant answers
CREATE TABLE IF NOT EXISTS cached_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  town_id TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  original_query TEXT NOT NULL,
  answer_html TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  UNIQUE(town_id, normalized_query)
);

-- Index for fast lookups (only non-expired entries)
CREATE INDEX idx_cached_answers_lookup
  ON cached_answers (town_id, normalized_query)
  WHERE expires_at > NOW();

-- Index for cleanup jobs
CREATE INDEX idx_cached_answers_expiry
  ON cached_answers (expires_at);

-- Optional: Add comment to table
COMMENT ON TABLE cached_answers IS 'Stores pre-computed AI answers for common queries. Entries expire after TTL (default 7 days).';
COMMENT ON COLUMN cached_answers.normalized_query IS 'Lowercase, punctuation-stripped query for matching. E.g. "transfer station hours"';
COMMENT ON COLUMN cached_answers.original_query IS 'Original query text as entered by user for debugging';
COMMENT ON COLUMN cached_answers.answer_html IS 'Full AI-generated answer (may contain markdown or HTML)';
COMMENT ON COLUMN cached_answers.sources IS 'Array of {title, url} objects for source citations';
COMMENT ON COLUMN cached_answers.hit_count IS 'Number of times this cached answer has been served (for analytics)';
