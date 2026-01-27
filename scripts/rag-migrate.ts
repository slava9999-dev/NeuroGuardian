#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — RAG Database Migration
// Creates tables and indexes for Hybrid Search
// ============================================

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';
import { vectorStore } from '../src/infrastructure/rag/VectorStore.js';

async function main() {
  console.log('📡 Connecting to Database...');

  // Get dynamic dimensions from the active provider
  const dimensions = vectorStore.dimensions;

  console.log(`info: Active Vector Dimensions: ${dimensions}`);

  try {
    // Drop existing table (Reset)
    console.log('   Dropping existing table...');
    await sql`DROP TABLE IF EXISTS knowledge_embeddings`;

    console.log('   Creating table...');
    // Use unsafe for DDL with dynamic type dimensions
    await sql.unsafe(`
      CREATE TABLE knowledge_embeddings (
        id SERIAL PRIMARY KEY,
        namespace VARCHAR(50) NOT NULL,
        source_file VARCHAR(255) NOT NULL,
        chunk_index INT NOT NULL DEFAULT 0,
        title VARCHAR(500),
        content TEXT NOT NULL,
        embedding vector(${dimensions}),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(namespace, source_file, chunk_index)
      )
    `);

    console.log('   Creating Indexes...');

    // 1. Structure Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_namespace ON knowledge_embeddings(namespace)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON knowledge_embeddings(source_file)`;

    // 2. Vector Index (HNSW)
    console.log('   - Index: HNSW (Vector)');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw 
      ON knowledge_embeddings 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;

    // 3. Full-Text Index (GIN)
    console.log('   - Index: GIN (Full-Text)');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_embeddings_content_fts 
      ON knowledge_embeddings 
      USING GIN (to_tsvector('russian', content))
    `;

    console.log('\n✅ Migration Complete: Table logic is ready for Hybrid Search.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

main();
