import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });
import { sql } from '@vercel/postgres';

async function checkSchema() {
  try {
    console.log('--- TABLE sentinel_logs ---');
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sentinel_logs'
      ORDER BY ordinal_position;
    `;
    console.table(cols.rows);

    if (cols.rows.length === 0) {
      console.log('Table sentinel_logs does not exist!');
    }
  } catch (err) {
    console.error('Error checking schema:', err);
  }
}

checkSchema().catch(console.error);
