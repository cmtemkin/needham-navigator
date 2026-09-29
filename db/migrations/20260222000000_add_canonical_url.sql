-- Ported from supabase/migrations/20260222000000_add_canonical_url.sql for Neon.
-- No changes required.
-- Regenerate with: npx tsx scripts/port-migrations-to-neon.ts

-- Add canonical_url column for URL deduplication
-- Canonical form: https, no-www, no trailing slash, lowercase
ALTER TABLE documents ADD COLUMN IF NOT EXISTS canonical_url TEXT;

COMMENT ON COLUMN documents.canonical_url IS
  'URL-canonicalized form (https, no-www, no-trailing-slash, lowercase) for dedup';
