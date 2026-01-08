import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '..');

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      value = value.replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
}

// Load environments
loadEnvFile(path.join(rootPath, '.env.production'));
loadEnvFile(path.join(rootPath, '.env.vercel'));
loadEnvFile(path.join(rootPath, '.env.local'));
loadEnvFile(path.join(rootPath, '.env'));

const url = (
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ''
)
  .replace(/\r/g, '')
  .trim();

async function main() {
  console.log('🚀 Direct Migration Start...');
  if (!url) {
    console.error('❌ No DB URL found');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString:
      url.includes('neon.tech') && !url.includes('sslmode')
        ? `${url}${url.includes('?') ? '&' : '?'}sslmode=require`
        : url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected. Applying schema changes...');

    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS estimated_buyer_price INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS marketplace_discount_percent INTEGER DEFAULT 0
    `);

    console.log('✅ Columns added successfully.');

    // Also ensure the price_rules table exists as it was mentioned in previous sessions as missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_rules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product_id TEXT NOT NULL,
        min_price INTEGER DEFAULT 0,
        max_price INTEGER DEFAULT 0,
        auto_adjust BOOLEAN DEFAULT false,
        competitor_tracking BOOLEAN DEFAULT false,
        competitor_nmids TEXT,
        adjustment_type TEXT DEFAULT 'percent',
        adjustment_value NUMERIC(10,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `);
    console.log('✅ Table price_rules verified.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
