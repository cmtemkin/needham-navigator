-- ============================================================================
-- Migration: 002_cost_tracking.sql
-- Description: Creates the api_costs table for tracking OpenAI API spend
--              per request (chat completions, embeddings, etc.).
--
-- NOTE: Run this migration manually in the Supabase SQL Editor, the same way
--       as the initial migration. Go to SQL Editor > New Query, paste this
--       file's contents, and click Run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  town_id TEXT NOT NULL DEFAULT 'needham',
  endpoint TEXT NOT NULL,              -- 'chat', 'embedding', 'content'
  model TEXT NOT NULL,                 -- 'gpt-4o-mini', 'gpt-5-nano', 'text-embedding-3-small', etc.
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 8) NOT NULL DEFAULT 0,
  metadata JSONB,                      -- optional: question length, source count, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_costs_created_at ON api_costs(created_at DESC);
CREATE INDEX idx_api_costs_endpoint ON api_costs(endpoint);
CREATE INDEX idx_api_costs_town_id ON api_costs(town_id);
