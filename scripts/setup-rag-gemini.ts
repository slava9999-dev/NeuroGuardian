#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — Gemini RAG Setup
// Uses Gemini text-embedding-004 (768 dims)
// Version: 1.0.0 | Date: January 2026
// ============================================

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { sql } from '../src/api-lib/services/database.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment!');
  process.exit(1);
}

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     NeuroGUARDIAN — Gemini RAG Setup (768 dims)               ║
║     Using: text-embedding-004                                 ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Namespace mapping
const NAMESPACE_MAPPING: Record<string, string> = {
  wb_api_rules: 'wb_api',
  wb_commissions: 'wb_api',
  wb_full_guide: 'wb_api',
  ozon_api_rules: 'ozon_api',
  ozon_commissions: 'ozon_api',
  ozon_full_guide: 'ozon_api',
  sentinel_instruction: 'sentinel',
  security_threats: 'sentinel',
  spp_buffer_guide: 'sentinel',
  pricing_strategies: 'pricing',
  unit_economics_guide: 'analytics',
  seasonality_calendar: 'analytics',
  faq: 'faq',
  api_keys_guide: 'onboarding',
  app_guide: 'onboarding',
  common_mistakes: 'faq',
  quick_responses: 'faq',
  success_cases: 'faq',
  reviews_guide: 'faq',
  viktor_personality: 'faq',
};

// Generate embedding using Gemini
async function getGeminiEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = (await response.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

// Simple chunker
function chunkText(text: string, maxSize = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 100) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }
  if (current.trim().length > 50) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

async function main() {
  // Step 1: Check connection
  console.log('📡 Step 1: Database connection...');
  try {
    await sql`SELECT 1`;
    console.log('   ✅ Connected');
  } catch (error) {
    console.error('   ❌ Failed:', error);
    process.exit(1);
  }

  // Step 2: Recreate table with 768 dims
  console.log('\n📋 Step 2: Recreating table with 768 dimensions...');
  try {
    console.log('   Dropping existing table...');
    await sql`DROP TABLE IF EXISTS knowledge_embeddings`;
    console.log('   Creating new table...');

    await sql`
      CREATE TABLE knowledge_embeddings (
        id SERIAL PRIMARY KEY,
        namespace VARCHAR(50) NOT NULL,
        source_file VARCHAR(255) NOT NULL,
        chunk_index INT NOT NULL DEFAULT 0,
        title VARCHAR(500),
        content TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(namespace, source_file, chunk_index)
      )
    `;
    console.log('   Table created, adding indexes...');

    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_namespace ON knowledge_embeddings(namespace)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON knowledge_embeddings(source_file)`;

    console.log('   ✅ Table recreated with vector(768)');
  } catch (error) {
    console.error('   ❌ Failed:', error instanceof Error ? error.message : error);
    console.error('   Full error:', error);
    process.exit(1);
  }

  // Step 3: Test Gemini embedding
  console.log('\n🧪 Step 3: Testing Gemini embedding...');
  try {
    const testEmbed = await getGeminiEmbedding('тест эмбеддинга');
    console.log(`   ✅ Gemini working, got ${testEmbed.length} dimensions`);
  } catch (error) {
    console.error('   ❌ Gemini API failed:', error);
    process.exit(1);
  }

  // Step 4: Ingest documents
  console.log('\n📚 Step 4: Ingesting knowledge base...');

  const knowledgePath = path.resolve(process.cwd(), 'docs/knowledge_base');
  const files = await fs.readdir(knowledgePath);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  let totalChunks = 0;
  let errors = 0;

  for (const file of mdFiles) {
    const fileName = file.replace('.md', '');
    const namespace = NAMESPACE_MAPPING[fileName] || 'faq';
    const filePath = path.join(knowledgePath, file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const title = content.match(/^#\s+(.+)$/m)?.[1] || fileName;
      const chunks = chunkText(content);

      console.log(`   📄 ${fileName}: ${chunks.length} chunks → ${namespace}`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Get embedding
        const embedding = await getGeminiEmbedding(chunk);

        // Insert into DB
        await sql`
          INSERT INTO knowledge_embeddings (
            namespace, source_file, chunk_index, title, content, embedding, metadata
          ) VALUES (
            ${namespace},
            ${fileName},
            ${i},
            ${title},
            ${chunk},
            ${JSON.stringify(embedding)}::vector,
            ${JSON.stringify({ totalChunks: chunks.length })}::jsonb
          )
          ON CONFLICT (namespace, source_file, chunk_index) 
          DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            updated_at = now()
        `;

        totalChunks++;

        // Rate limiting - Gemini has limits
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${file}:`, error);
      errors++;
    }
  }

  // Step 5: Create HNSW index
  console.log('\n🚀 Step 5: Creating HNSW vector index...');
  try {
    await sql`
      CREATE INDEX idx_embeddings_hnsw 
      ON knowledge_embeddings 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;
    console.log('   ✅ HNSW index created');
  } catch (error) {
    console.log('   ⚠️  HNSW index error (may already exist):', error);
  }

  // Step 6: Verify
  console.log('\n✅ Step 6: Verification...');
  const stats = await sql`
    SELECT namespace, COUNT(*) as count 
    FROM knowledge_embeddings 
    GROUP BY namespace 
    ORDER BY count DESC
  `;

  console.log('\n📊 Documents by namespace:');
  for (const row of stats.rows) {
    console.log(`   • ${row.namespace}: ${row.count} chunks`);
  }

  const total = await sql`SELECT COUNT(*) as count FROM knowledge_embeddings`;

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║     ✅ RAG SETUP COMPLETE!                                    ║
╠═══════════════════════════════════════════════════════════════╣
║     Total chunks: ${String(total.rows[0].count).padEnd(41)}║
║     Errors: ${String(errors).padEnd(48)}║
║     Embedding model: text-embedding-004 (768 dims)            ║
╚═══════════════════════════════════════════════════════════════╝
`);

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
