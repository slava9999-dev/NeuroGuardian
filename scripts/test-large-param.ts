import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function test() {
  const large = 'x'.repeat(30000);
  console.log('Testing with string of length:', large.length);
  try {
    const r = await sql`SELECT ${large} as val`;
    console.log('OK, result length:', r.rows[0].val.length);
  } catch (e) {
    console.error('FAILED:', e);
  }
}

test();
