import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function check() {
  try {
    const r = await sql`SELECT 1 as connected`;
    console.log('DB Status:', r.rows[0]);

    const table =
      await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'knowledge_embeddings'`;
    console.log('Table exists:', table.rows);

    if (table.rows.length > 0) {
      const count = await sql`SELECT COUNT(*) FROM knowledge_embeddings`;
      console.log('Document count:', count.rows[0].count);
    }
  } catch (e) {
    console.error('Check failed:', e);
  }
}

check();
