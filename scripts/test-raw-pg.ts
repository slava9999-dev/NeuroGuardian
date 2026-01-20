import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function test() {
  const connectionString = process.env.POSTGRES_URL;
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting...');
  const large = 'x'.repeat(3500);
  console.log('Testing with string of length:', large.length);

  try {
    const res = await pool.query('SELECT $1::text as val', [large]);
    console.log('OK, result length:', res.rows[0].val.length);
  } catch (e) {
    console.error('FAILED:', e);
  } finally {
    await pool.end();
  }
}

test();
