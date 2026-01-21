// Check actual DB schema for sentinel_logs
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function main() {
  console.log('🔍 Checking sentinel_logs table structure...\n');

  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'sentinel_logs'
    ORDER BY ordinal_position
  `);

  console.log('📋 Columns in sentinel_logs:');
  for (const row of result.rows) {
    console.log(`  - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
  }

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
