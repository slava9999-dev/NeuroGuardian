import 'dotenv/config';
import { sql } from '../src/api-lib/services/database.js';

async function test() {
  console.log('Dropping/Creating 10D table...');
  try {
    await sql.unsafe('DROP TABLE IF EXISTS test_small_vec CASCADE');
    await sql.unsafe('CREATE TABLE test_small_vec (id SERIAL PRIMARY KEY, embedding vector(10))');
    console.log('Table created');

    const vec = new Array(10).fill(0.5);
    const vecStr = JSON.stringify(vec);
    console.log('Inserting vector:', vecStr);

    await sql`INSERT INTO test_small_vec (embedding) VALUES (${vecStr})`;
    console.log('SUCCESS');

    const count = await sql`SELECT COUNT(*) FROM test_small_vec`;
    console.log('Count:', count.rows[0].count);
  } catch (e) {
    console.error('FAILED:', e);
  }
}

test();
