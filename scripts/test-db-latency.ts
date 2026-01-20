import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function check() {
  console.log('Waiting 6 seconds to simulate latency...');
  await new Promise(r => setTimeout(r, 6000));

  try {
    const r = await sql`SELECT 1 as connected`;
    console.log('DB Status after delay:', r.rows[0]);
  } catch (e) {
    console.error('Check failed:', e);
  }
}

check();
