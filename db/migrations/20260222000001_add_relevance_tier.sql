-- Ported from supabase/migrations/20260222000001_add_relevance_tier.sql for Neon.
-- No changes required.
-- Regenerate with: npx tsx scripts/port-migrations-to-neon.ts

-- Add relevance_tier classification column for tiered search filtering
ALTER TABLE documents ADD COLUMN IF NOT EXISTS relevance_tier TEXT
  DEFAULT 'primary'
  CHECK (relevance_tier IN ('primary', 'regional', 'state', 'supplementary', 'archive', 'irrelevant'));

CREATE INDEX IF NOT EXISTS idx_documents_relevance_tier ON documents(relevance_tier);

COMMENT ON COLUMN documents.relevance_tier IS
  'Content relevance: primary (Needham-specific), regional, state, supplementary, archive, irrelevant';
