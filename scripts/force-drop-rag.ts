import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function main() {
  console.log('🔥 Forcing drop of knowledge_embeddings...');
  try {
    await sql.unsafe('DROP TABLE IF EXISTS knowledge_embeddings CASCADE');
    console.log('✅ Dropped successfully');
  } catch (e) {
    console.error('❌ Failed:', e);
  }
}

main().catch(console.error);
