#!/usr/bin/env npx tsx
// ============================================
// NeuroGUARDIAN — RAG Ingestion Only
// ============================================

import 'dotenv/config';
import { knowledgeIngestion } from '../src/infrastructure/rag/IngestionPipeline.js';
import { sql } from '../src/api-lib/services/database.js';

async function main() {
  console.log('📚 Starting Knowledge Ingestion...');

  const knowledgePath = 'docs/knowledge_base';

  try {
    const result = await knowledgeIngestion.ingestDirectory(knowledgePath, 'faq', {
      recursive: false,
      filePattern: /\.md$/,
    });

    console.log('\n📊 Ingestion Report:');
    console.log(`   • Documents Processed: ${result.documentsProcessed}`);
    console.log(`   • Chunks Created:      ${result.chunksCreated}`);
    console.log(`   • Total Time:          ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`   • Files Successful:    ${result.successfulFiles.length}`);
    result.successfulFiles.forEach(file => console.log(`     - ${file}`));

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      console.log(`   • Files Failed:        ${result.failedFiles.length}`);
      result.failedFiles.forEach(file => console.log(`     - ${file}`));
      result.errors.forEach(err => console.log(`   - ${err}`));
    }

    // Verify count
    const count = await sql`SELECT COUNT(*) as c FROM knowledge_embeddings`;
    console.log(`\n✅ Total Database Rows: ${count.rows[0].c}`);

    process.exit(result.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Ingestion failed with fatal error:', error);
    process.exit(1);
  }
}

main();
