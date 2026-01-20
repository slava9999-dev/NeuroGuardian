import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function check() {
  try {
    const r = await sql`
      SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, atttypmod
      FROM information_schema.columns
      JOIN pg_attribute ON attname = column_name
      WHERE table_name = 'knowledge_embeddings' AND column_name = 'embedding'
      AND attrelid = 'public.knowledge_embeddings'::regclass
    `;
    console.log('Column info:', r.rows[0]);
    if (r.rows[0]) {
      console.log('Vector dimension:', r.rows[0].atttypmod - 4);
    }
  } catch (e) {
    console.error('Check failed:', e);
  }
}

check();
