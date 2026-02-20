-- Drop vector search infrastructure from Supabase
-- Run this AFTER verifying Pinecone search works correctly
-- This frees ~4.5 GB of storage (embedding columns + HNSW indexes)

-- Drop RPC functions (vector search now handled by Pinecone)
DROP FUNCTION IF EXISTS match_documents;
DROP FUNCTION IF EXISTS match_content_items;

-- Drop HNSW indexes (frees ~2.2 GB)
DROP INDEX IF EXISTS document_chunks_embedding_idx;
DROP INDEX IF EXISTS content_items_embedding_idx;

-- Drop embedding columns (frees ~2.3 GB including TOAST data)
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE content_items DROP COLUMN IF EXISTS embedding;

-- Note: Keep pgvector extension installed in case needed later
-- DROP EXTENSION IF EXISTS vector;

COMMENT ON TABLE document_chunks IS 'Chunk text + metadata stored here. Vector embeddings stored in Pinecone.';
