-- Neon-only migration (no Supabase equivalent).
--
-- src/lib/rag.ts runs a websearch_to_tsquery match against document_chunks.chunk_text
-- on the hot path of every search. There has never been a full-text index, so Postgres
-- computed to_tsvector('english', chunk_text) for every row on every query — a
-- sequential scan over the entire corpus.
--
-- The index expression MUST stay byte-identical to the expression emitted by
-- src/lib/db.ts textSearch(), or the planner will ignore this index and silently
-- fall back to the sequential scan.

CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON document_chunks
  USING GIN (to_tsvector('english', chunk_text));

COMMENT ON INDEX idx_chunks_fts IS
  'Full-text search over chunk_text. Expression must match src/lib/db.ts textSearch() exactly.';
