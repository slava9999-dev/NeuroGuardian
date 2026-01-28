#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — Vector Store Setup Script
// Creates pgvector table and indexes knowledge base
// Version: 1.0.0 | Date: January 2026
// ============================================

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';
import { vectorStore } from '../src/infrastructure/rag/VectorStore.js';
import {
  knowledgeIngestion,
  ingestKnowledgeBase,
} from '../src/infrastructure/rag/IngestionPipeline.js';

async function printStats() {
  console.log('✅ Verification...');
  try {
    const stats = await vectorStore.getStats();
    console.log('');
    console.log('   📊 Vector Store Statistics:');
    console.log(`      • Total documents: ${stats.totalDocuments}`);
    console.log('      • By namespace:');
    for (const [ns, count] of Object.entries(stats.byNamespace)) {
      console.log(`        - ${ns}: ${count}`);
    }
    if (stats.lastUpdated) {
      console.log(`      • Last updated: ${stats.lastUpdated}`);
    }
  } catch (error) {
    console.error('   ⚠️  Could not get stats:', error);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       NeuroGUARDIAN — Vector Store Setup                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const statsOnly = process.argv.includes('--stats-only');

  if (statsOnly) {
    console.log('ℹ️  Running in STATS ONLY mode');
    console.log('');
    await printStats();
    process.exit(0);
  }

  // Step 1: Check database connection
  console.log('📡 Step 1: Checking database connection...');
  try {
    const result = await sql`SELECT 1 as test, NOW() as time`;
    console.log('   ✅ Database connected at:', result.rows[0].time);
  } catch (error) {
    console.error('   ❌ Database connection failed:', error);
    console.log('');
    console.log('   💡 If running locally from Russia, try:');
    console.log('      • Use VPN');
    console.log('      • Or run this script on Vercel via API endpoint');
    process.exit(1);
  }

  // Step 2: Check/Enable pgvector extension
  console.log('');
  console.log('🔌 Step 2: Checking pgvector extension...');
  try {
    const extCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `;

    if (extCheck.rows[0].has_vector) {
      console.log('   ✅ pgvector extension already enabled');
    } else {
      console.log('   📦 Enabling pgvector extension...');
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('   ✅ pgvector extension enabled');
    }
  } catch (error) {
    console.error('   ❌ Failed to enable pgvector:', error);
    console.log('   💡 Make sure your Neon plan supports pgvector (it should by default)');
    process.exit(1);
  }

  // Step 3: Create knowledge_embeddings table
  console.log('');
  console.log('📋 Step 3: Creating knowledge_embeddings table...');
  try {
    // Check available keys to determine dimension
    const ragProvider = process.env.RAG_PROVIDER?.toLowerCase();
    const hasHF = !!process.env.HUGGINGFACE_API_KEY && ragProvider === 'huggingface';
    const hasOpenAI =
      !!process.env.OPENAI_API_KEY && (ragProvider === 'openai' || (!ragProvider && !hasHF));
    const hasGemini =
      (!!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) &&
      (ragProvider === 'gemini' || (!ragProvider && !hasHF && !hasOpenAI));

    let vectorDim = 1536; // Default
    if (ragProvider === 'huggingface' || hasHF) {
      vectorDim = 1024;
    } else if (ragProvider === 'gemini') {
      vectorDim = 768;
    } else if (hasOpenAI) {
      vectorDim = 1536;
    } else if (hasGemini) {
      vectorDim = 768;
    }

    console.log(
      `   ℹ️  Detected provider: ${ragProvider === 'huggingface' || hasHF ? 'HuggingFace' : ragProvider === 'gemini' ? 'Gemini (Forced)' : hasOpenAI ? 'OpenAI' : hasGemini ? 'Gemini' : 'None'}`
    );
    console.log(`   ℹ️  Vector dimensions: ${vectorDim}`);

    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'knowledge_embeddings'
      ) as has_table
    `;

    if (tableCheck.rows[0].has_table) {
      console.log('   ⚠️  Table already exists.');

      // Check current dimension
      const dimCheck = await sql`
        SELECT atttypmod FROM pg_attribute 
        WHERE attrelid = 'knowledge_embeddings'::regclass 
        AND attname = 'embedding'
      `;

      const currentDim = dimCheck.rows[0].atttypmod;
      if (currentDim !== vectorDim && currentDim !== -1) {
        console.log(
          `   🔄 Dimension mismatch: Current ${currentDim} vs Target ${vectorDim}. Recreating table...`
        );
        try {
          await sql.unsafe(`DROP TABLE IF EXISTS knowledge_embeddings CASCADE`);
          console.log('   ✅ Table dropped');
          // Update table check flag
          tableCheck.rows[0].has_table = false;
        } catch (dropError) {
          console.warn('   ⚠️  Drop attempt failed:', (dropError as Error).message);
        }
      } else {
        console.log(`   ✅ Dimension (${currentDim}) matches existing table or default.`);
      }
    }

    // Step 3.1: Final Create Table (Idempotent)
    if (!tableCheck.rows[0].has_table) {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS knowledge_embeddings (
          id SERIAL PRIMARY KEY,
          namespace VARCHAR(50) NOT NULL,
          source_file VARCHAR(255) NOT NULL,
          chunk_index INT NOT NULL DEFAULT 0,
          title VARCHAR(500),
          content TEXT NOT NULL,
          embedding vector(${vectorDim}),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(namespace, source_file, chunk_index)
        )
      `);
      console.log('   ✅ Table ensured');

      // Create indexes
      console.log('   📊 Creating indexes...');

      await sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_namespace 
        ON knowledge_embeddings(namespace)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_source 
        ON knowledge_embeddings(source_file)
      `;

      // Full-text search index
      await sql`
        CREATE INDEX IF NOT EXISTS idx_embeddings_content_fts 
        ON knowledge_embeddings USING gin(to_tsvector('russian', content))
      `;

      console.log('   ✅ Indexes created');
    }
  } catch (error) {
    console.error('   ❌ Failed to create table:', error);
    process.exit(1);
  }

  // Step 4: Check HNSW index (requires embeddings first)
  console.log('');
  console.log('🔍 Step 4: Vector index will be created after ingestion');

  // Step 5: Ingest knowledge base
  console.log('');
  console.log('📚 Step 5: Ingesting knowledge base documents...');

  // Check if we have embedding API key
  const ragProvider = process.env.RAG_PROVIDER?.toLowerCase();
  const hasHF = !!process.env.HUGGINGFACE_API_KEY && ragProvider === 'huggingface';
  const hasOpenAI =
    !!process.env.OPENAI_API_KEY && (ragProvider === 'openai' || (!ragProvider && !hasHF));
  const hasGemini =
    (!!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) &&
    (ragProvider === 'gemini' || (!ragProvider && !hasHF && !hasOpenAI));

  if (!hasHF && !hasOpenAI && !hasGemini) {
    console.log('   ⚠️  No embedding API key found!');
    console.log('   Set HUGGINGFACE_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY.');
    console.log('');
    console.log(
      '   📌 Table structure is ready. Run this script again with API key to ingest documents.'
    );
    process.exit(0);
  }

  console.log(
    `   Using ${ragProvider === 'huggingface' || hasHF ? 'HuggingFace' : ragProvider === 'gemini' ? 'Gemini' : hasOpenAI ? 'OpenAI' : 'Gemini'} for embeddings`
  );

  try {
    const startTime = Date.now();
    const result = await ingestKnowledgeBase();

    console.log('');
    console.log('   📊 Ingestion Results:');
    console.log(`      • Documents processed: ${result.documentsProcessed}`);
    console.log(`      • Chunks created: ${result.chunksCreated}`);
    console.log(`      • Duration: ${result.duration}ms`);

    if (result.errors.length > 0) {
      console.log(`      • Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`        - ${e}`));
    }
  } catch (error) {
    console.error('   ❌ Ingestion failed:', error);
    process.exit(1);
  }

  // Step 6: Create HNSW index (now that we have data)
  console.log('');
  console.log('🚀 Step 6: Creating HNSW vector index...');
  try {
    // Check if we have embeddings
    const countResult = await sql`
      SELECT COUNT(*) as count FROM knowledge_embeddings WHERE embedding IS NOT NULL
    `;

    if (parseInt(countResult.rows[0].count) > 0) {
      // Drop existing index if any
      await sql`DROP INDEX IF EXISTS idx_embeddings_hnsw`;

      // Create HNSW index
      await sql`
        CREATE INDEX idx_embeddings_hnsw 
        ON knowledge_embeddings 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      console.log('   ✅ HNSW index created');
    } else {
      console.log('   ⚠️  No embeddings found, skipping HNSW index');
    }
  } catch (error) {
    console.error('   ⚠️  HNSW index creation failed (may already exist):', error);
  }

  // Step 7: Verify
  console.log('');
  console.log('Step 7: Verification...');
  await printStats();

  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       ✅ Vector Store Setup Complete!                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Next steps:');
  console.log('1. Add WB/Ozon API documentation to docs/knowledge_base/');
  console.log('2. Run this script again to index new documents');
  console.log('3. Test search with: npm run test:rag');
  console.log('');

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
