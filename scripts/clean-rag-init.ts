import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function main() {
  console.log('🔄 Complete RAG Reset...');
  try {
    // Drop everything related to RAG
    await sql.unsafe('DROP TABLE IF EXISTS knowledge_embeddings CASCADE');
    console.log('✅ TABLE DROPPED');

    // Wait a bit for DB to catch up
    await new Promise(r => setTimeout(r, 1000));

    const ragProvider = process.env.RAG_PROVIDER?.toLowerCase() || 'gemini';
    const vectorDim = ragProvider === 'huggingface' ? 1024 : 768;

    console.log(`🏗️ Creating table with ${vectorDim} dimensions (Provider: ${ragProvider})...`);

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
    console.log('✅ TABLE CREATED');

    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS idx_embeddings_namespace ON knowledge_embeddings(namespace)'
    );
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS idx_embeddings_source ON knowledge_embeddings(source_file)'
    );
    await sql.unsafe(
      "CREATE INDEX IF NOT EXISTS idx_embeddings_content_fts ON knowledge_embeddings USING gin(to_tsvector('russian', content))"
    );
    console.log('✅ INDEXES CREATED');
  } catch (e) {
    console.error('❌ RESET FAILED:', e);
  }
}

main().catch(console.error);
