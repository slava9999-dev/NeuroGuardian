import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_oTBa8XY0mjyQ@ep-late-salad-agr4ecke.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  console.log('🛡️ Starting Hunter Mode Migration...');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Add columns

    // competitor_url
    try {
      await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS competitor_url TEXT`);
      console.log('✅ Added competitor_url');
    } catch (e) {
      console.log('⚠️ competitor_url exists or error:', (e as Error).message);
    }

    // competitor_price
    try {
      await pool.query(
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS competitor_price INTEGER DEFAULT 0`
      );
      console.log('✅ Added competitor_price');
    } catch (e) {
      console.log('⚠️ competitor_price exists or error:', (e as Error).message);
    }

    // price_strategy
    try {
      await pool.query(
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS price_strategy VARCHAR(50) DEFAULT 'passive'`
      );
      console.log('✅ Added price_strategy');
    } catch (e) {
      console.log('⚠️ price_strategy exists or error:', (e as Error).message);
    }

    // min_margin (just in case)
    try {
      await pool.query(
        `ALTER TABLE products ADD COLUMN IF NOT EXISTS min_margin INTEGER DEFAULT 0`
      );
    } catch {}

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
