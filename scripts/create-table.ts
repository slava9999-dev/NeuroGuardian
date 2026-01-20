import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function create() {
  console.log('Creating table knowledge_embeddings with 1024 dims...');
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('Extension checked');

    await sql.unsafe(`DROP TABLE IF EXISTS knowledge_embeddings CASCADE`);
    console.log('Table dropped');

    await sql.unsafe(`
        CREATE TABLE knowledge_embeddings (
          id SERIAL PRIMARY KEY,
          namespace VARCHAR(50) NOT NULL,
          source_file VARCHAR(255) NOT NULL,
          chunk_index INT NOT NULL DEFAULT 0,
          title VARCHAR(500),
          content TEXT NOT NULL,
          embedding vector(384),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(namespace, source_file, chunk_index)
        )
    `);
    console.log('Table created');

    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_namespace ON knowledge_embeddings(namespace)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON knowledge_embeddings(source_file)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_content_fts ON knowledge_embeddings USING gin(to_tsvector('russian', content))`;
    console.log('Indexes created');
  } catch (e) {
    console.error('Creation failed:', e);
  }
}

create();
