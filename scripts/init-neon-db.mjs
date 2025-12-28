#!/usr/bin/env node
/**
 * Neon Database Initialization Script
 * Uses @neondatabase/serverless for better connection handling
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function runQuery(name, query) {
  try {
    await sql(query);
    console.log(`  ✅ ${name}`);
    return true;
  } catch (error) {
    console.log(`  ❌ ${name}: ${error.message}`);
    return false;
  }
}

async function initializeDatabase() {
  console.log('🔌 Connecting to Neon PostgreSQL...\n');

  // Check current tables
  console.log('📋 Checking existing tables...');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `;
  
  if (tables.length > 0) {
    console.log('Existing tables:');
    tables.forEach(row => console.log(`  - ${row.table_name}`));
  } else {
    console.log('No tables found.');
  }
  console.log('');

  // 1. Users table
  console.log('📦 Creating/updating tables...');
  
  await runQuery('users table', `
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY,
      username VARCHAR(255),
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255),
      photo_url TEXT,
      is_active BOOLEAN DEFAULT true,
      api_key_wb TEXT,
      api_key_ozon TEXT,
      ozon_client_id VARCHAR(255),
      protection_enabled BOOLEAN DEFAULT false,
      defense_mode VARCHAR(50) DEFAULT 'zero_stock',
      subscription_plan VARCHAR(50) DEFAULT 'trial',
      subscription_end TIMESTAMP,
      subscription_active BOOLEAN DEFAULT false,
      payment_method_id VARCHAR(255),
      total_products INTEGER DEFAULT 0,
      triggered_today INTEGER DEFAULT 0,
      saved_amount DECIMAL(12, 2) DEFAULT 0,
      referral_code VARCHAR(50) UNIQUE,
      referred_by VARCHAR(50),
      last_reminder_sent TIMESTAMP,
      price_buffer_percent INTEGER DEFAULT 5,
      warning_threshold_percent INTEGER DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery('marketplace_accounts table', `
    CREATE TABLE IF NOT EXISTS marketplace_accounts (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      marketplace VARCHAR(10) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      wb_token TEXT,
      ozon_client_id TEXT,
      ozon_api_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_sync_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery('products table', `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR(255) NOT NULL,
      nm_id BIGINT,
      official_sku VARCHAR(255),
      offer_id VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      image_url TEXT,
      current_price INTEGER NOT NULL,
      min_price INTEGER DEFAULT 0,
      cost_price INTEGER DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      marketplace VARCHAR(50) NOT NULL,
      is_monitored BOOLEAN DEFAULT true,
      pending_price INTEGER,
      pending_task_id BIGINT,
      pending_status VARCHAR(50),
      pending_since TIMESTAMP,
      account_id INTEGER REFERENCES marketplace_accounts(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )
  `);

  await runQuery('transactions table', `
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(255) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      yookassa_payment_id VARCHAR(255) UNIQUE,
      amount DECIMAL(12, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(50) NOT NULL,
      plan VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    )
  `);

  await runQuery('sentinel_logs table', `
    CREATE TABLE IF NOT EXISTS sentinel_logs (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR(255),
      product_title VARCHAR(255),
      detected_price INTEGER NOT NULL,
      min_price INTEGER NOT NULL,
      defense_action VARCHAR(50) NOT NULL,
      saved_amount INTEGER DEFAULT 0,
      marketplace VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery('chat_history table', `
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery('marketplace_orders table', `
    CREATE TABLE IF NOT EXISTS marketplace_orders (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES marketplace_accounts(id) ON DELETE SET NULL,
      marketplace VARCHAR(20) NOT NULL,
      order_id VARCHAR(255) NOT NULL,
      product_id VARCHAR(255),
      marketplace_product_id VARCHAR(255) NOT NULL,
      title VARCHAR(255),
      order_date TIMESTAMP NOT NULL,
      status VARCHAR(50) NOT NULL,
      price_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      commission DECIMAL(12, 2) DEFAULT 0,
      logistics DECIMAL(12, 2) DEFAULT 0,
      cost_price DECIMAL(12, 2) DEFAULT 0,
      region VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, marketplace, order_id)
    )
  `);

  // Indexes
  console.log('\n📊 Creating indexes...');
  
  await runQuery('idx_products_user_id', 'CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)');
  await runQuery('idx_transactions_user_id', 'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
  await runQuery('idx_sentinel_logs_user_id', 'CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user_id ON sentinel_logs(user_id)');
  await runQuery('idx_orders_user_id', 'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON marketplace_orders(user_id)');
  await runQuery('idx_orders_account_id', 'CREATE INDEX IF NOT EXISTS idx_orders_account_id ON marketplace_orders(account_id)');
  await runQuery('idx_products_marketplace', 'CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace)');
  await runQuery('idx_orders_order_date', 'CREATE INDEX IF NOT EXISTS idx_orders_order_date ON marketplace_orders(order_date)');

  // Final check
  console.log('\n📋 Final table check:');
  const finalTables = await sql`
    SELECT 
      t.table_name,
      COUNT(c.column_name) as columns
    FROM information_schema.tables t
    LEFT JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = 'public'
    WHERE t.table_schema = 'public'
    GROUP BY t.table_name
    ORDER BY t.table_name
  `;
  
  finalTables.forEach(row => {
    console.log(`  ✅ ${row.table_name} (${row.columns} columns)`);
  });

  // Row counts
  console.log('\n📊 Table statistics:');
  for (const table of finalTables) {
    try {
      const count = await sql(`SELECT COUNT(*) as cnt FROM ${table.table_name}`);
      console.log(`  ${table.table_name}: ${count[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${table.table_name}: error counting`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 DATABASE SETUP COMPLETE!');
  console.log('='.repeat(50));
  
  console.log('\n📌 Environment variables for .env:');
  console.log(`POSTGRES_URL="${DATABASE_URL}"`);
  console.log(`DATABASE_URL="${DATABASE_URL}"`);
}

initializeDatabase()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
