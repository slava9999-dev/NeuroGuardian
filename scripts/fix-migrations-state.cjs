const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.master');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = require('dotenv').parse(envContent);
Object.assign(process.env, envConfig);

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const KNOWN_MIGRATIONS = [
  '001_create_users.sql',
  '002_create_products.sql',
  '003_create_transactions.sql',
  '004_create_sentinel_logs.sql',
  '005_create_chat_history.sql',
  '006_add_performance_indexes.sql',
  '007_add_offer_id.sql',
  '008_add_price_buffer_settings.sql',
  '009_add_cost_price.sql',
  '010_create_orders.sql',
  '011_add_ozon_client_id.sql'
];

async function markMigration(name) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Ensure table exists (idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await client.query(`
      INSERT INTO migrations (name) VALUES ($1)
      ON CONFLICT (name) DO NOTHING
    `, [name]);
    console.log(`✅ Marked ${name}`);
  } catch (e) {
    console.error(`❌ Error marking ${name}:`, e.message);
  } finally {
    await client.end();
  }
}

async function fixMigrations() {
  console.log('🔄 ensuring migration state...');
  for (const name of KNOWN_MIGRATIONS) {
    await markMigration(name);
    // Tiny delay to be gentle
    await new Promise(r => setTimeout(r, 200));
  }
  console.log('✨ Base state fixed.');
}

fixMigrations();
