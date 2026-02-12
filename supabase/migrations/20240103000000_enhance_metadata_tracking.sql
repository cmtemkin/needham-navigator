-- Migration 003: Enhance Metadata Tracking
--
-- Adds columns and indexes to support production-grade ingestion pipeline:
-- - last_crawled: timestamp of last crawl attempt (success or failure)
-- - last_changed: timestamp when content_hash last changed
-- - Indexes for performance optimization

-- Add missing timestamp columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS last_crawled TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_changed TIMESTAMPTZ;

-- Add index for content_hash lookups (used in incremental crawling)
CREATE INDEX IF NOT EXISTS idx_documents_content_hash
  ON documents(content_hash);

-- Add index for last_verified_at queries (used in staleness detection)
CREATE INDEX IF NOT EXISTS idx_documents_last_verified
  ON documents(last_verified_at)
  WHERE is_stale = false;

-- Add index for source_type (useful for monitoring different document types)
CREATE INDEX IF NOT EXISTS idx_documents_source_type
  ON documents(source_type);

-- Add GIN index for metadata JSONB searches (enables fast metadata queries)
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_gin
  ON document_chunks USING GIN (metadata);

-- Add index for chunk_index (used in result ordering and chunk retrieval)
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index
  ON document_chunks(document_id, chunk_index);

-- Add comments for documentation
COMMENT ON COLUMN documents.last_crawled IS 'Timestamp of last crawl attempt (success or failure)';
COMMENT ON COLUMN documents.last_changed IS 'Timestamp when content_hash last changed';
COMMENT ON INDEX idx_documents_last_verified IS 'Fast lookup for stale documents (>90 days)';
COMMENT ON INDEX idx_documents_content_hash IS 'Fast lookup for incremental crawling (hash comparison)';
COMMENT ON INDEX idx_chunks_metadata_gin IS 'Fast JSONB metadata queries (department, document_type, etc.)';
COMMENT ON INDEX idx_chunks_chunk_index IS 'Fast chunk ordering and retrieval';
