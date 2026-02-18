-- Create the sources table for managing scraper source URLs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id TEXT NOT NULL DEFAULT 'needham',
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  update_frequency TEXT NOT NULL DEFAULT 'weekly',
  document_type TEXT NOT NULL DEFAULT 'html',
  max_depth INTEGER NOT NULL DEFAULT 2,
  max_pages INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(town_id, url)
);

CREATE INDEX IF NOT EXISTS idx_sources_town_active ON sources(town_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sources_category ON sources(category);

-- Enable RLS but allow service role full access
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to sources"
  ON sources
  FOR ALL
  USING (true)
  WITH CHECK (true);
