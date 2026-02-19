-- Drop unused indexes to reduce write amplification
-- Every INSERT/UPDATE/DELETE must maintain ALL indexes on the table.
-- These indexes are never used in application queries.

-- document_chunks: GIN on metadata (filtering done in app code, not SQL)
DROP INDEX IF EXISTS idx_chunks_metadata_gin;

-- content_items: GIN on metadata (same — never queried by JSONB in SQL)
DROP INDEX IF EXISTS idx_content_items_metadata;

-- content_items: standalone hash index (redundant — covered by UNIQUE constraint)
DROP INDEX IF EXISTS idx_content_items_hash;

-- search_telemetry: GIN on array columns (expensive; only for analytics on a 30-day-retained table)
DROP INDEX IF EXISTS idx_telemetry_intent;
DROP INDEX IF EXISTS idx_telemetry_source_hints;

-- search_telemetry: boolean index (low cardinality = useless)
DROP INDEX IF EXISTS idx_telemetry_decomposed;

-- documents: AI enrichment indexes (feature not yet active; re-add when needed)
DROP INDEX IF EXISTS idx_documents_content_type;
DROP INDEX IF EXISTS idx_documents_last_enriched;

-- Summary: 8 indexes dropped. ~30% less write amplification per INSERT/UPDATE.
