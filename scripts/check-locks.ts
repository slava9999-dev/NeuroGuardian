import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function checkLocks() {
  try {
    const r = await sql`
      SELECT pid, mode, locktype, granted
      FROM pg_locks
      WHERE relation = 'public.knowledge_embeddings'::regclass
    `;
    console.log('Locks:', r.rows);
  } catch (e) {
    console.error('Check failed:', e);
  }
}

checkLocks();
