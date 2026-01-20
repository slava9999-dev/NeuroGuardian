import 'dotenv/config';
import { createClient } from '@vercel/postgres';

async function test() {
  console.log('Testing with Vercel Postgres (createClient)...');
  console.log('URL defined:', !!process.env.POSTGRES_URL);

  const large = 'x'.repeat(30000);

  try {
    const client = createClient({
      connectionString: process.env.POSTGRES_URL,
    });
    await client.connect();
    console.log('Connected via createClient');

    const res = await client.sql`SELECT ${large} as val`;
    console.log('OK, result length:', res.rows[0].val.length);
    // client.release(); // Vercel client might not need release or it's different
  } catch (e) {
    console.error('FAILED:', e);
  }
}

test();
