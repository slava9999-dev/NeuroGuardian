import { sql } from '../src/api-lib/services/database.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
process.env.DEBUG = 'true';

async function check() {
  console.log('🔌 Connecting to DB...');
  const start = Date.now();
  try {
    const res = await sql`SELECT NOW()`;
    console.log(`✅ Connected in ${Date.now() - start}ms`);

    // 1. Fetch IDs
    console.log('📦 Fetching IDs...');
    const idRes = await sql`SELECT id FROM products WHERE user_id = 7548070478`;
    const ids = idRes.rows.map((r: any) => r.id);
    console.log(`✅ IDs fetched: ${ids.length}`);

    // 2. Fetch Chunks
    const CHUNK_SIZE = 5;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      console.log(`📦 Fetching chunk ${i / CHUNK_SIZE + 1} (${chunk.length} items)...`);

      try {
        const rawQuery = `SELECT * FROM products WHERE id IN (${chunk.join(',')})`;
        // Simulating the Raw construction manually if needed, or just using sql tag if we can imports
        // But here we import sql from database.local directly probably so we need Raw class?
        // Wait, sql string works?
        // In database.local.ts `sql(string)` returns `Raw`.
        // So `sql`${sql(string)}`` works.

        const res = await sql`${sql(rawQuery)}`;
        console.log(`✅ Chunk ${i / CHUNK_SIZE + 1} fetched: ${(res as any).rows.length} rows`);

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error('❌ Chunk failed:', e);
      }
    }
  } catch (err) {
    console.error('❌ Failed:', err);
  } finally {
    process.exit(0);
  }
}

check();
