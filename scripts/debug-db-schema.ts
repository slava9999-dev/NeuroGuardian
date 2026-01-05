import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function debugSchema() {
  console.log('🔍 Debugging DB Schema...');

  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('\nTables:', tables.rows.map(r => r.table_name).join(', '));

    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ops_events'
    `;
    console.log('\nOps Events Columns:');
    console.table(columns.rows);

    const userColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    console.log('\nUsers Columns:');
    console.table(userColumns.rows);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error debugging schema:', err);
    process.exit(1);
  }
}

debugSchema();
