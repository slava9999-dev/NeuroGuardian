-- ============================================
-- NeuroGUARDIAN — Vector Store Migration
-- Creates pgvector extension and embeddings table
-- Version: 1.0.0 | Date: January 2026
-- ============================================

-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing table if exists (for clean migration)
DROP TABLE IF EXISTS knowledge_embeddings CASCADE;

-- Main embeddings table for RAG
CREATE TABLE knowledge_embeddings (
  id SERIAL PRIMARY KEY,
  
  -- Namespace for filtering (e.g., 'wb_api', 'ozon_api', 'sentinel')
  namespace VARCHAR(50) NOT NULL,
  
  -- Source tracking
  source_file VARCHAR(255) NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  
  -- Content
  title VARCHAR(500),
  content TEXT NOT NULL,
  
  -- Vector embedding (768 dimensions for Gemini text-embedding-004)
  embedding vector(768),
  
  -- Metadata (tags, version, etc.)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(namespace, source_file, chunk_index)
);

-- Create HNSW index for fast similarity search
-- HNSW is faster than IVFFlat for most workloads
CREATE INDEX ON knowledge_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for namespace filtering
CREATE INDEX idx_embeddings_namespace ON knowledge_embeddings(namespace);

-- Index for source file lookups
CREATE INDEX idx_embeddings_source ON knowledge_embeddings(source_file);

-- Full-text search index for hybrid search
CREATE INDEX idx_embeddings_content_fts ON knowledge_embeddings 
  USING gin(to_tsvector('russian', content));

-- Comment for documentation
COMMENT ON TABLE knowledge_embeddings IS 'RAG vector store for NeuroGUARDIAN knowledge base';
COMMENT ON COLUMN knowledge_embeddings.namespace IS 'Category: wb_api, ozon_api, sentinel, pricing, analytics, faq';
COMMENT ON COLUMN knowledge_embeddings.embedding IS 'Gemini text-embedding-004 (768 dims)';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS embeddings_updated_at ON knowledge_embeddings;
CREATE TRIGGER embeddings_updated_at
  BEFORE UPDATE ON knowledge_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_embeddings_timestamp();

-- ============================================
-- Helper functions for vector operations
-- ============================================

-- Function: Search similar vectors with namespace filter
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(768),
  search_namespace VARCHAR(50) DEFAULT NULL,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id INT,
  namespace VARCHAR(50),
  title VARCHAR(500),
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.namespace,
    ke.title,
    ke.content,
    1 - (ke.embedding <=> query_embedding) as similarity,
    ke.metadata
  FROM knowledge_embeddings ke
  WHERE 
    (search_namespace IS NULL OR ke.namespace = search_namespace)
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Hybrid search (vector + full-text)
CREATE OR REPLACE FUNCTION hybrid_search_embeddings(
  query_embedding vector(768),
  query_text TEXT,
  search_namespace VARCHAR(50) DEFAULT NULL,
  match_count INT DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id INT,
  namespace VARCHAR(50),
  title VARCHAR(500),
  content TEXT,
  vector_score FLOAT,
  text_score FLOAT,
  combined_score FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.namespace,
    ke.title,
    ke.content,
    1 - (ke.embedding <=> query_embedding) as vector_score,
    ts_rank(to_tsvector('russian', ke.content), plainto_tsquery('russian', query_text)) as text_score,
    (vector_weight * (1 - (ke.embedding <=> query_embedding))) + 
    ((1 - vector_weight) * ts_rank(to_tsvector('russian', ke.content), plainto_tsquery('russian', query_text))) as combined_score,
    ke.metadata
  FROM knowledge_embeddings ke
  WHERE 
    (search_namespace IS NULL OR ke.namespace = search_namespace)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Initial seed data check
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Vector store migration completed successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run embedding pipeline to populate knowledge_embeddings';
  RAISE NOTICE '2. Verify with: SELECT COUNT(*) FROM knowledge_embeddings;';
END $$;
