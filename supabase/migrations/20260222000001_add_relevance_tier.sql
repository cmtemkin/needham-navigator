-- Add relevance_tier classification column for tiered search filtering
ALTER TABLE documents ADD COLUMN IF NOT EXISTS relevance_tier TEXT
  DEFAULT 'primary'
  CHECK (relevance_tier IN ('primary', 'regional', 'state', 'supplementary', 'archive', 'irrelevant'));

CREATE INDEX IF NOT EXISTS idx_documents_relevance_tier ON documents(relevance_tier);

COMMENT ON COLUMN documents.relevance_tier IS
  'Content relevance: primary (Needham-specific), regional, state, supplementary, archive, irrelevant';
