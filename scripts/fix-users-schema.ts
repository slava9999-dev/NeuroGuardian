import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

async function migrate() {
  console.log('🚀 Running manual migration...');
  try {
    // 1. Add telegram_id column if missing
    console.log('Checking users table for telegram_id...');
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT`;

    // 2. Populate telegram_id from id (since for initial users they are the same)
    console.log('Populating telegram_id where null...');
    await sql`UPDATE users SET telegram_id = id WHERE telegram_id IS NULL`;

    // 3. Ensure index exists
    console.log('Creating index for telegram_id...');
    await sql`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`;

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
