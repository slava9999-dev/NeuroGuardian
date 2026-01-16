import pg from 'pg';
import * as dotenv from 'dotenv';
const { Pool } = pg;

dotenv.config();
dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = ['users', 'products', 'marketplace_accounts'];
    for (const table of tables) {
      console.log(`\n--- SCHEMA FOR ${table.toUpperCase()} ---`);
      const cols = await pool.query(`
        SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      console.table(cols.rows);

      console.log(`\n--- INDEXES FOR ${table.toUpperCase()} ---`);
      const idxs = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
      `, [table]);
      console.table(idxs.rows);
    }
    
    // Check for active queries/locks if any
    console.log('\n--- ACTIVE QUERIES ---');
    const queries = await pool.query(`
      SELECT pid, now() - query_start as duration, query, state
      FROM pg_stat_activity
      WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
    `);
    console.table(queries.rows);

    await pool.end();
  } catch (err) {
    console.error(err);
  }
}

run();
