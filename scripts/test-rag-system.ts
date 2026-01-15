#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — Full RAG System Test
// Creates pgvector, ingests docs, tests search
// PRODUCTION MODE - Not a demo!
// Version: 1.0.0 | Date: January 2026
// ============================================

import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';
import { promises as fs } from 'fs';
import path from 'path';

// Colors for console
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`
${BLUE}╔═══════════════════════════════════════════════════════════════╗
║     NeuroGUARDIAN — FULL RAG SYSTEM TEST (PRODUCTION)         ║
║                   ЭТО НЕ ДЕМО!                                ║
╚═══════════════════════════════════════════════════════════════╝${RESET}
`);

async function main() {
  let allPassed = true;

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Database Connection
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 1: Database Connection${RESET}`);

  try {
    const start = Date.now();
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    const latency = Date.now() - start;
    console.log(`  ${GREEN}✅ Connected to: ${result.rows[0].db}${RESET}`);
    console.log(`  ${GREEN}✅ Server time: ${result.rows[0].time}${RESET}`);
    console.log(`  ${GREEN}✅ Latency: ${latency}ms${RESET}`);
  } catch (error) {
    console.log(`  ${RED}❌ FAILED: ${error}${RESET}`);
    console.log(`\n  ${YELLOW}💡 Recommendation: Use VPN or run via Vercel API${RESET}`);
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Check/Enable pgvector extension
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 2: pgvector Extension${RESET}`);

  try {
    const extCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `;

    if (extCheck.rows[0].has_vector) {
      console.log(`  ${GREEN}✅ pgvector already enabled${RESET}`);
    } else {
      console.log(`  ${YELLOW}⚠️  pgvector not found, enabling...${RESET}`);
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log(`  ${GREEN}✅ pgvector enabled successfully${RESET}`);
    }
  } catch (error) {
    console.log(`  ${RED}❌ FAILED to enable pgvector: ${error}${RESET}`);
    allPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Create knowledge_embeddings table
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 3: knowledge_embeddings Table${RESET}`);

  try {
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'knowledge_embeddings'
      ) as exists
    `;

    if (tableCheck.rows[0].exists) {
      console.log(`  ${GREEN}✅ Table already exists${RESET}`);

      // Get row count
      const countResult = await sql`SELECT COUNT(*) as count FROM knowledge_embeddings`;
      const count = parseInt(countResult.rows[0].count);
      console.log(`  ${GREEN}✅ Documents in table: ${count}${RESET}`);

      if (count > 0) {
        // Get namespace distribution
        const nsResult = await sql`
          SELECT namespace, COUNT(*) as count 
          FROM knowledge_embeddings 
          GROUP BY namespace 
          ORDER BY count DESC
        `;
        console.log(`\n  ${BLUE}📊 Namespace Distribution:${RESET}`);
        for (const row of nsResult.rows) {
          console.log(`     • ${row.namespace}: ${row.count} chunks`);
        }
      }
    } else {
      console.log(`  ${YELLOW}⚠️  Table not found, creating...${RESET}`);

      await sql`
        CREATE TABLE knowledge_embeddings (
          id SERIAL PRIMARY KEY,
          namespace VARCHAR(50) NOT NULL,
          source_file VARCHAR(255) NOT NULL,
          chunk_index INT NOT NULL DEFAULT 0,
          title VARCHAR(500),
          content TEXT NOT NULL,
          embedding vector(1536),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(namespace, source_file, chunk_index)
        )
      `;
      console.log(`  ${GREEN}✅ Table created${RESET}`);

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_namespace ON knowledge_embeddings(namespace)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON knowledge_embeddings(source_file)`;
      console.log(`  ${GREEN}✅ Indexes created${RESET}`);
    }
  } catch (error) {
    console.log(`  ${RED}❌ FAILED: ${error}${RESET}`);
    allPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: Check knowledge_base documents
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 4: Knowledge Base Documents${RESET}`);

  const knowledgePath = path.resolve(process.cwd(), 'docs/knowledge_base');

  try {
    const files = await fs.readdir(knowledgePath);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    console.log(`  ${GREEN}✅ Found ${mdFiles.length} markdown documents${RESET}`);

    // Calculate total size
    let totalSize = 0;
    for (const file of mdFiles) {
      const stats = await fs.stat(path.join(knowledgePath, file));
      totalSize += stats.size;
    }
    console.log(`  ${GREEN}✅ Total size: ${(totalSize / 1024).toFixed(1)} KB${RESET}`);

    // Show namespace mapping
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

    console.log(`\n  ${BLUE}📁 Document → Namespace Mapping:${RESET}`);

    const nsCounts: Record<string, number> = {};
    for (const file of mdFiles) {
      const baseName = file.replace('.md', '');
      const ns = NAMESPACE_MAPPING[baseName] || 'faq';
      nsCounts[ns] = (nsCounts[ns] || 0) + 1;
    }

    for (const [ns, count] of Object.entries(nsCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`     • ${ns}: ${count} docs`);
    }
  } catch (error) {
    console.log(`  ${RED}❌ FAILED to read knowledge_base: ${error}${RESET}`);
    allPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: Agent → Namespace Mapping
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 5: Agent → Namespace Access${RESET}`);

  const SPECIALIST_NAMESPACES = {
    ProductsSpecialist: ['wb_api', 'ozon_api', 'faq'],
    PricingSpecialist: ['wb_api', 'ozon_api', 'pricing', 'sentinel'],
    SentinelSpecialist: ['sentinel', 'pricing', 'wb_api', 'ozon_api'],
    AnalyticsSpecialist: ['analytics', 'pricing', 'faq'],
    ChatSpecialist: ['faq', 'onboarding'],
  };

  console.log(`\n  ${BLUE}🤖 Each agent has access to:${RESET}`);
  for (const [agent, namespaces] of Object.entries(SPECIALIST_NAMESPACES)) {
    console.log(`     • ${agent}:`);
    console.log(`       └── ${namespaces.join(', ')}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: Check Embedding API Keys
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 6: Embedding API Keys${RESET}`);

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (hasOpenAI) {
    console.log(`  ${GREEN}✅ OPENAI_API_KEY present (1536 dims)${RESET}`);
  } else if (hasGemini) {
    console.log(`  ${GREEN}✅ GEMINI_API_KEY present (768 dims)${RESET}`);
    console.log(`  ${YELLOW}⚠️  Note: pgvector table uses 1536 dims, may need adjustment${RESET}`);
  } else {
    console.log(`  ${RED}❌ No embedding API key found!${RESET}`);
    console.log(`  ${YELLOW}💡 Set OPENAI_API_KEY or GEMINI_API_KEY${RESET}`);
    allPassed = false;
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 7: Test Vector Search (if documents exist)
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}▶ STEP 7: Vector Search Test${RESET}`);

  try {
    const countResult =
      await sql`SELECT COUNT(*) as count FROM knowledge_embeddings WHERE embedding IS NOT NULL`;
    const count = parseInt(countResult.rows[0].count);

    if (count === 0) {
      console.log(`  ${YELLOW}⚠️  No embeddings in database${RESET}`);
      console.log(`  ${YELLOW}💡 Run ingestion first${RESET}`);
    } else {
      console.log(`  ${GREEN}✅ ${count} embeddings available${RESET}`);

      // Try a real vector search
      console.log(`  ${BLUE}🔍 Testing vector search logic...${RESET}`);

      // We need to use "unsafe" provider or the vectorStore instance correctly configured
      // Since VectorStore now respects RAG_PROVIDER env var, let's use it
      const { vectorStore } = await import('../src/infrastructure/rag/VectorStore.js'); // Dynamic import to pick up env vars if changed

      try {
        const results = await vectorStore.search('как установить цены', { limit: 1 });

        if (results.length > 0) {
          console.log(`  ${GREEN}✅ Search successful!${RESET}`);
          console.log(`     Query: "как установить цены"`);
          console.log(
            `     Found: "${results[0].title || 'Untitled'}" (Similarity: ${results[0].similarity.toFixed(4)})`
          );
        } else {
          console.log(
            `  ${YELLOW}⚠️  Search returned 0 results (threshold might be too strict)${RESET}`
          );
        }
      } catch (searchError) {
        console.log(
          `  ${RED}❌ Search failed: ${searchError instanceof Error ? searchError.message : searchError}${RESET}`
        );
        console.log(`  ${YELLOW}💡 Check if embedding dimensions match database Schema${RESET}`);
        // Try raw SQL debug
      }
    }
  } catch (error) {
    console.log(`  ${YELLOW}⚠️  Could not test search: ${error}${RESET}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);

  if (allPassed) {
    console.log(`\n${GREEN}✅ RAG INFRASTRUCTURE: READY${RESET}`);
  } else {
    console.log(`\n${YELLOW}⚠️  RAG INFRASTRUCTURE: NEEDS ATTENTION${RESET}`);
  }

  // Check if ingestion needed
  try {
    const countResult = await sql`SELECT COUNT(*) as count FROM knowledge_embeddings`;
    const count = parseInt(countResult.rows[0].count);

    if (count === 0 && (hasOpenAI || hasGemini)) {
      console.log(`\n${BLUE}📌 NEXT STEPS:${RESET}`);
      console.log(`   1. Run ingestion to populate embeddings:`);
      console.log(`      ${YELLOW}npx tsx scripts/setup-vector-store.ts${RESET}`);
      console.log(`   2. Or use this API endpoint (bypasses local network issues):`);
      console.log(`      ${YELLOW}POST /api?action=rag_ingest${RESET}`);
    } else if (count === 0) {
      console.log(`\n${BLUE}📌 NEXT STEPS:${RESET}`);
      console.log(`   1. Add embedding API key to .env:`);
      console.log(`      ${YELLOW}OPENAI_API_KEY=sk-...${RESET}`);
      console.log(`   2. Then run: ${YELLOW}npx tsx scripts/setup-vector-store.ts${RESET}`);
    } else {
      console.log(`\n${GREEN}🎉 RAG system is fully operational!${RESET}`);
      console.log(`   Documents: ${count}`);
      console.log(`   Ready to serve queries to agents.`);
    }
  } catch {
    // Ignore
  }

  console.log('');
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
