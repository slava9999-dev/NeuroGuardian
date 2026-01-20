import 'dotenv/config';
import {
  knowledgeIngestion,
  IngestionSource,
} from '../src/infrastructure/rag/IngestionPipeline.js';
import { vectorStore } from '../src/infrastructure/rag/VectorStore.js';
import { logger } from '../src/api-lib/lib/logger.js';
import { sql } from '../src/api-lib/services/database.js';

/**
 * Rebuilds the Vector Store with new embeddings
 *
 * 1. Verifies database connection and schema
 * 2. Clears existing embeddings if requested
 * 3. Ingests all knowledge base documents
 * 4. Verifies the results
 */
async function main() {
  logger.info('🚀 Starting Vector Store Rebuild...');

  // 1. Check Environment
  const provider = process.env.RAG_PROVIDER || 'gemini';
  logger.info(`📝 RAG Provider: ${provider.toUpperCase()}`);

  if (provider === 'huggingface' && !process.env.HUGGINGFACE_API_KEY) {
    logger.error('❌ HUGGINGFACE_API_KEY is missing!');
    process.exit(1);
  }

  // 2. Clear Existing Data
  logger.info('🧹 Clearing existing embeddings...');
  try {
    const result = await sql`DELETE FROM knowledge_embeddings`;
    logger.info(`✅ Deleted ${result.rowCount} existing embeddings.`);
  } catch (error) {
    logger.error('❌ Error clearing table:', error);
    process.exit(1);
  }

  // 3. Define Sources
  // We use the flat directory structure of docs/knowledge_base
  // The pipeline maps filenames to namespaces automatically
  const sources: IngestionSource[] = [
    {
      path: 'docs/knowledge_base',
      namespace: 'faq', // Default namespace, specific ones overridden by filename mapping
      recursive: false,
      filePattern: /\.md$/,
    },
  ];

  // 4. Run Ingestion
  logger.info('📚 Ingesting documents...');
  const results = await knowledgeIngestion.ingestSources(sources);

  // 5. Summary
  let totalDocs = 0;
  let totalChunks = 0;
  let errors = 0;

  results.forEach(res => {
    totalDocs += res.documentsProcessed;
    totalChunks += res.chunksCreated;
    errors += res.errors.length;

    if (res.errors.length > 0) {
      logger.error(`❌ Errors in ${res.source}:`, res.errors);
    }
  });

  logger.info('========================================');
  logger.info(`✅ Rebuild Complete!`);
  logger.info(`📄 Documents: ${totalDocs}`);
  logger.info(`🧩 Chunks:    ${totalChunks}`);
  logger.info(`❌ Errors:    ${errors}`);
  logger.info('========================================');

  // 6. Verify Vector Dimension
  try {
    const sample = await sql`
      SELECT vector_dims(embedding) as dims 
      FROM knowledge_embeddings 
      LIMIT 1
    `;
    if (sample.rows.length > 0) {
      logger.info(`📏 Vector Dimensions: ${sample.rows[0].dims}`);
    }
  } catch (err) {
    logger.warn('⚠️ Could not verify vector dimensions (pgvector function might be missing)');
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  logger.error('❌ Fatal Error:', err);
  process.exit(1);
});
