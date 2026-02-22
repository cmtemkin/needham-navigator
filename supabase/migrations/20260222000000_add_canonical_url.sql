-- Add canonical_url column for URL deduplication
-- Canonical form: https, no-www, no trailing slash, lowercase
ALTER TABLE documents ADD COLUMN IF NOT EXISTS canonical_url TEXT;

COMMENT ON COLUMN documents.canonical_url IS
  'URL-canonicalized form (https, no-www, no-trailing-slash, lowercase) for dedup';
