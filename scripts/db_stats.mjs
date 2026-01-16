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
    const tables = ['users', 'products', 'marketplace_accounts', 'sentinel_logs', 'ops_events', 'marketplace_orders'];
    console.log('--- TABLE STATISTICS ---');
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT count(*) as count FROM "${table}"`);
        console.log(`[${table.toUpperCase()}]: ${res.rows[0].count} rows`);
      } catch (e) {
        console.log(`[${table.toUpperCase()}]: Table likely missing or error: ${e.message}`);
      }
    }

    console.log('\n--- CHECKING INDEXES ON PRODUCTS ---');
    const idxs = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'products'
    `);
    console.table(idxs.rows);

    console.log('\n--- COLUMN TYPES FOR PRODUCTS ---');
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name IN ('id', 'user_id', 'product_id', 'nm_id')
    `);
    console.table(cols.rows);

    await pool.end();
  } catch (err) {
    console.error('Audit failed:', err.message);
    process.exit(1);
  }
}

run();
