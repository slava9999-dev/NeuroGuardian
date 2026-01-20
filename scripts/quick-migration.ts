// ============================================
// Quick Database Migration Script
// Run with: npx tsx scripts/quick-migration.ts
// ============================================

import pkg from 'pg';
const { Pool } = pkg;

const connectionString =
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_oTBa8XY0mjyQ@ep-late-salad-agr4ecke.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

async function runMigration() {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log('🔄 Running database migrations...');

  const queries = [
    // Add min_margin column
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS min_margin INTEGER DEFAULT 0`,

    // Add barcode column
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(255)`,

    // Add dimensions columns
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS depth_cm INTEGER`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,3)`,

    // Create subscription_plans table
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      monthly_price DECIMAL(12, 2) NOT NULL,
      products_limit INTEGER NOT NULL,
      ai_tokens_limit INTEGER NOT NULL,
      features JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Seed default plans
    `INSERT INTO subscription_plans (id, name, monthly_price, products_limit, ai_tokens_limit, features)
    VALUES 
    ('trial', 'Пробный', 0, 10, 50, '{"sentinel": true, "vision": false}'),
    ('standard', 'Стандарт', 999, 100, 500, '{"sentinel": true, "vision": true}'),
    ('premium', 'Премиум', 2999, 1000, 5000, '{"sentinel": true, "vision": true, "priority_support": true}')
    ON CONFLICT (id) DO NOTHING`,

    // Create media_assets table
    `CREATE TABLE IF NOT EXISTS media_assets (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'image',
      status VARCHAR(50) DEFAULT 'pending',
      original_url TEXT,
      processed_url TEXT,
      thumbnail_url TEXT,
      vision_metadata JSONB DEFAULT '{}',
      width INTEGER,
      height INTEGER,
      mime_type VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
      console.log(`✅ ${q.substring(0, 60)}...`);
    } catch (err) {
      const e = err as Error;
      console.log(`⚠️  ${q.substring(0, 40)}... - ${e.message}`);
    }
  }

  console.log('\n✅ Migration complete!');
  await pool.end();
  process.exit(0);
}

runMigration().catch(console.error);
