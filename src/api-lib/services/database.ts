// ============================================
// NeuroGUARDIAN — Database Service
// Handles all PostgreSQL operations via @vercel/postgres
// Version: 2.1.0 | Date: December 2024
// ============================================

// Use local pg driver for local development, @vercel/postgres for production
// We check for VERCEL_REGION to ensure we're actually on the Vercel platform

// Use pg pool for all environments to ensure resilience (retries, timeouts)
import pkg from 'pg';
const { Pool } = pkg;
import type { QueryResult, PoolConfig, PoolClient } from 'pg';

import { config } from '../../infrastructure/config/env.js';
import { logger, decryptApiKey } from '../lib/index.js';

let _pool: pkg.Pool | null = null;

function getPool(): pkg.Pool {
  if (_pool) return _pool;

  const connectionString = config.POSTGRES_URL.replace(/\r/g, '').trim();
  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('postgres') ||
    connectionString.includes('db');

  // Use SSL only if explicitly requested in URL OR if production and NOT local
  const useSsl =
    connectionString.includes('sslmode=require') ||
    (process.env.NODE_ENV === 'production' && !isLocal && process.env.DB_NO_SSL !== 'true');

  // Optimized for Neon/Vercel Postgres with Node 25+
  const poolConfig: PoolConfig = {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5, // Reduced for Serverless/Neon stability
    idleTimeoutMillis: 5000, // Aggressively close idle connections to avoid stale ones
    connectionTimeoutMillis: 10000, // Fail fast on connection
    keepAlive: true,
    statement_timeout: 60000, // 1 minute per query
    application_name: 'neuroguardian_v2',
  };

  _pool = new Pool(poolConfig);
  _pool.setMaxListeners(20); // Increase limit for many concurrent requests

  _pool.on('error', (err: Error) => {
    // Avoid crashing on pool errors
    logger.warn('[Database] Pool Error', { error: err.message });
  });

  return _pool;
}

/**
 * Execute query with automatic retries for transient network errors
 */
async function executeWithRetry(text: string, values: unknown[]): Promise<QueryResult> {
  const pool = getPool();
  const retries = 5;
  let attempt = 0;

  while (attempt < retries) {
    attempt++;
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();

      // Prevent process crash on background errors (like ECONNRESET)
      // We check if we already attached our handler to this specific client instance
      if (!(client as any)._neuro_handler_attached) {
        client.on('error', (err: Error) => {
          logger.warn(`[Database] ⚠️ Client session background error: ${err.message}`);
        });
        (client as any)._neuro_handler_attached = true;
      }

      // Ensure specific search path
      await client.query('SET search_path TO public');

      const res = await client.query(text, values);
      return res;
    } catch (error: unknown) {
      const err = error as Error;
      const msg = err.message || String(error);

      const isTransient =
        msg.includes('timeout') ||
        msg.includes('terminated') ||
        msg.includes('RESET') ||
        msg.includes('SSL') ||
        msg.includes('ECONNRESET') ||
        msg.includes('socket') ||
        msg.includes('connection') ||
        msg.includes('EOF');

      if (isTransient && attempt < 5) {
        const delay = 2000 * attempt + Math.random() * 1000;
        logger.warn(
          `[Database] 🚦 Attempt ${attempt} failed: ${msg}. Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      logger.error('[Database] ❌ DB Error:', {
        message: msg,
        query: text.substring(0, 200),
        attempt,
      });
      throw error;
    } finally {
      if (client) {
        // Release re-attaches pool error listener and removes ours
        client.release();
      }
    }
  }
  throw new Error('Database retries exhausted');
}

/**
 * Tagged template literal for SQL queries (compatible with @vercel/postgres)
 */
export const sql = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResult> => {
    let text = strings[0];
    const queryValues: unknown[] = [];

    for (let i = 0; i < values.length; i++) {
      queryValues.push(values[i]);
      text += `$${queryValues.length}${strings[i + 1]}`;
    }

    return executeWithRetry(text, queryValues);
  },
  {
    unsafe: (text: string, values: unknown[] = []): Promise<QueryResult> =>
      executeWithRetry(text, values),
  }
);

import type { DBProduct, PendingPriceUpdate } from '../lib/types.js';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  is_active: boolean;
  api_key_wb?: string;
  api_key_ozon?: string;
  ozon_client_id?: string;
  protection_enabled: boolean;
  defense_mode: 'zero_stock' | 'price_correction';
  subscription_plan: 'trial' | 'standard' | 'premium';
  subscription_end?: Date;
  subscription_active: boolean;
  payment_method_id?: string;
  total_products: number;
  triggered_today: number;
  saved_amount: number;
  referral_code?: string;
  referred_by?: string;
  last_reminder_sent?: Date;
  price_buffer_percent: number;
  warning_threshold_percent: number;
  tax_rate: number;
  voice_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MarketplaceOrder {
  order_id: string;
  user_id: number;
  account_id?: number | null;
  marketplace: 'WB' | 'Ozon' | 'wb' | 'ozon';
  product_id?: string | null;
  marketplace_product_id: string;
  title?: string | null;
  order_date: Date;
  status: string;
  price_total: number;
  quantity: number;
  commission: number;
  logistics: number;
  cost_price: number;
  region?: string | null;
}

export interface TransactionData {
  id: string;
  user_id: number;
  yookassa_payment_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  plan: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

function decryptUser(user: TelegramUser): TelegramUser {
  if (!user) return user;
  try {
    if (user.api_key_wb) user.api_key_wb = decryptApiKey(user.api_key_wb);
    if (user.api_key_ozon) user.api_key_ozon = decryptApiKey(user.api_key_ozon);
    // ozon_client_id might be encrypted or plaintext
    if (user.ozon_client_id) user.ozon_client_id = decryptApiKey(user.ozon_client_id);
  } catch (e) {
    logger.warn(`Failed to decrypt keys for user ${user.id}`, { error: e });
  }
  return user;
}

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  // 1. Users table
  await sql`
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
  `;

  // 2. Marketplace Accounts (Multi-account support)
  await sql`
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
  `;

  // 3. Products
  await sql`
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
  `;

  // Ensure account_id exists if table was created before
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES marketplace_accounts(id) ON DELETE SET NULL`;

  // Add SPP Buffer columns for smart stop-loss calculation
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS target_buyer_price INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS spp_buffer_percent INTEGER DEFAULT 25`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_adjust_min_price BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_buyer_price INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace_discount_percent DECIMAL(5,2)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_margin INTEGER DEFAULT 0`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(255)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS depth_cm INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,3)`;

  // 4. Transactions
  // 4. Transactions & Subscriptions
  await sql`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      monthly_price DECIMAL(12, 2) NOT NULL,
      products_limit INTEGER NOT NULL,
      ai_tokens_limit INTEGER NOT NULL,
      features JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id VARCHAR(50) NOT NULL REFERENCES subscription_plans(id),
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      current_period_end TIMESTAMP NOT NULL,
      cancel_at_period_end BOOLEAN DEFAULT false,
      yookassa_sub_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_type VARCHAR(50) NOT NULL,
      amount INTEGER NOT NULL DEFAULT 1,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
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
  `;

  // Seed default plans if not exists
  await sql`
    INSERT INTO subscription_plans (id, name, monthly_price, products_limit, ai_tokens_limit, features)
    VALUES 
    ('trial', 'Пробный', 0, 10, 50, '{"sentinel": true, "vision": false}'),
    ('standard', 'Стандарт', 999, 100, 500, '{"sentinel": true, "vision": true}'),
    ('premium', 'Премиум', 2999, 1000, 5000, '{"sentinel": true, "vision": true, "priority_support": true}')
    ON CONFLICT (id) DO NOTHING
  `;

  // Helper function for subscription check
  await sql`
    CREATE OR REPLACE FUNCTION is_subscription_active(target_user_id BIGINT) 
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE user_id = target_user_id 
        AND status IN ('active', 'trial') 
        AND current_period_end > NOW()
      );
    END;
    $$ LANGUAGE plpgsql;
  `;

  // 5. Sentinel Logs
  await sql`
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      threat_type VARCHAR(50),
      success BOOLEAN DEFAULT true,
      details JSONB DEFAULT '{}'
    )
  `;

  // Ensure new columns exist
  await sql`ALTER TABLE sentinel_logs ADD COLUMN IF NOT EXISTS threat_type VARCHAR(50)`;
  await sql`ALTER TABLE sentinel_logs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE sentinel_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'`;

  // 6. Chat History
  await sql`
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 7. Marketplace Orders (Sales history)
  await sql`
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
  `;

  // Ensure account_id exists
  await sql`ALTER TABLE marketplace_orders ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES marketplace_accounts(id) ON DELETE SET NULL`;

  // 8. Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user_id ON sentinel_logs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON marketplace_orders(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_account_id ON marketplace_orders(account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_protection ON users(protection_enabled, subscription_active) WHERE protection_enabled = true`;

  // 9. User State (Agent V5)
  await sql`
    CREATE TABLE IF NOT EXISTS user_state (
      user_id BIGINT PRIMARY KEY,
      state_data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 10. Operations Events (Ops Logger)
  await sql`
    CREATE TABLE IF NOT EXISTS ops_events (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      event_source VARCHAR(50) NOT NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      product_id BIGINT,
      payload JSONB DEFAULT '{}',
      old_price INTEGER,
      new_price INTEGER,
      competitor_price INTEGER,
      action_taken VARCHAR(50),
      marketplace VARCHAR(20),
      external_id VARCHAR(255),
      severity VARCHAR(20) DEFAULT 'INFO',
      entity_type VARCHAR(50),
      entity_id VARCHAR(255),
      processed_at TIMESTAMP,
      processing_result JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 11. Operations Audit (Immutable)
  await sql`
    CREATE TABLE IF NOT EXISTS ops_audit (
      id SERIAL PRIMARY KEY,
      actor_type VARCHAR(20) NOT NULL,
      actor_id VARCHAR(255),
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id VARCHAR(255),
      old_value JSONB,
      new_value JSONB,
      metadata JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      user_agent TEXT,
      request_id VARCHAR(255),
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Indexes for Ops Logs
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_events_user_id ON ops_events(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_events_created_at ON ops_events(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_events_type ON ops_events(event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_audit_resource ON ops_audit(resource_type, resource_id)`;

  logger.info('Database schema initialized');
}

import { userRepository } from '../repositories/UserRepository.js';
import { productRepository } from '../repositories/ProductRepository.js';

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<TelegramUser | null> {
  return userRepository.getById(id);
}

/**
 * Create or update user
 */
export async function createOrUpdateUser(user: Partial<TelegramUser>): Promise<TelegramUser> {
  return userRepository.createOrUpdate(user);
}

export async function setProtectionEnabled(id: number, enabled: boolean): Promise<void> {
  return userRepository.setProtectionEnabled(id, enabled);
}

export async function setDefenseMode(
  id: number,
  mode: 'zero_stock' | 'price_correction'
): Promise<void> {
  return userRepository.setDefenseMode(id, mode);
}

/**
 * Get user's products
 */
export async function getProductsByUserId(userId: number, accountId?: number) {
  return productRepository.getByUserId(userId, accountId);
}

export async function getFilteredProducts(
  userId: number,
  filters: {
    search?: string;
    marketplace?: string;
    limit?: number;
    offset?: number;
    lowStockOnly?: boolean;
    unprotectedOnly?: boolean;
    accountId?: number;
  }
) {
  return productRepository.getFiltered(userId, filters);
}

export async function updateProductMinPrice(
  userId: number,
  productId: string,
  minPrice: number
): Promise<void> {
  return productRepository.updateMinPrice(userId, productId, minPrice);
}

export async function updateProductCostPrice(
  userId: number,
  productId: string,
  costPrice: number
): Promise<void> {
  return productRepository.updateCostPrice(userId, productId, costPrice);
}

export async function batchUpdateCostPrices(
  userId: number,
  updates: Array<{ productId: string; costPrice: number }>
): Promise<void> {
  return productRepository.batchUpdateCostPrices(userId, updates);
}

export async function updateProductCategory(
  userId: number,
  productId: string,
  category: string
): Promise<void> {
  await sql`
    UPDATE products 
    SET category = ${category}, updated_at = NOW() 
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

export async function updateProductPrice(
  userId: number,
  productId: string,
  price: number
): Promise<void> {
  return productRepository.updatePrice(userId, productId, price);
}

export async function bulkUpdateMinPrice(
  userId: number,
  percentage: number,
  filters: { marketplace?: string; onlyUnprotected?: boolean }
) {
  return productRepository.bulkUpdateMinPrice(userId, percentage, filters);
}

export async function batchUpdateWbPrices(_userId: number, _updates: unknown[]): Promise<void> {
  // Placeholder - logic in marketplace service usually
}

export async function batchUpdateOzonPrices(_userId: number, _updates: unknown[]): Promise<void> {
  // Placeholder
}

export async function activateSubscription(
  userId: number,
  plan: string,
  durationDays: number
): Promise<void> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);
  await sql`UPDATE users SET subscription_plan = ${plan}, subscription_end = ${endDate.toISOString()}, subscription_active = true, updated_at = NOW() WHERE id = ${userId}`;
}

export async function createTransaction(tx: TransactionData): Promise<void> {
  await sql`
    INSERT INTO transactions (id, user_id, yookassa_payment_id, amount, currency, status, plan, created_at)
    VALUES (${tx.id}, ${tx.user_id}, ${tx.yookassa_payment_id || null}, ${tx.amount}, ${tx.currency}, ${tx.status}, ${tx.plan}, NOW())
  `;
}

export async function updateTransactionStatus(
  id: string,
  status: string,
  paymentId?: string
): Promise<void> {
  if (paymentId) {
    await sql`UPDATE transactions SET status = ${status}, yookassa_payment_id = ${paymentId}, paid_at = CASE WHEN ${status} = 'succeeded' THEN NOW() ELSE paid_at END WHERE id = ${id}`;
  } else {
    await sql`UPDATE transactions SET status = ${status}, paid_at = CASE WHEN ${status} = 'succeeded' THEN NOW() ELSE paid_at END WHERE id = ${id}`;
  }
}

export async function isFirstPayment(userId: number): Promise<boolean> {
  const result =
    await sql`SELECT COUNT(*) as count FROM transactions WHERE user_id = ${userId} AND status = 'succeeded'`;
  return parseInt((result.rows[0] as { count: string }).count) === 0;
}

export async function getUsersWithExpiringSubscriptions(days: number): Promise<TelegramUser[]> {
  // Validate input to prevent SQL injection
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    throw new Error('Invalid days parameter: must be integer between 0 and 365');
  }

  // Use parameterized query with safe interval construction
  const result = await sql`
    SELECT * FROM users
    WHERE subscription_active = true
    AND subscription_end <= NOW() + ${days} * INTERVAL '1 day'
  `;
  return result.rows as TelegramUser[];
}

export async function markReminderSent(userId: number): Promise<void> {
  await sql`UPDATE users SET last_reminder_sent = NOW() WHERE id = ${userId}`;
}

export async function applyReferralBonus(userId: number, bonusAmount: number): Promise<void> {
  await sql`UPDATE users SET saved_amount = saved_amount + ${bonusAmount} WHERE id = ${userId}`;
}

// === PENDING PRICE TRACKING ===

export async function setPendingPrice(
  userId: number,
  productId: string,
  price: number,
  taskId?: string
): Promise<void> {
  await sql`
    UPDATE products 
    SET pending_price = ${price}, pending_task_id = ${taskId || null}, pending_status = 'pending', pending_since = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

export async function clearPendingPrice(userId: number, productId: string): Promise<void> {
  await sql`
    UPDATE products 
    SET pending_price = NULL, pending_task_id = NULL, pending_status = NULL, pending_since = NULL
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

export async function confirmPendingPrice(userId: number, productId: string): Promise<void> {
  await sql`
    UPDATE products 
    SET current_price = COALESCE(pending_price, current_price), 
        pending_price = NULL, pending_task_id = NULL, pending_status = 'completed', pending_since = NULL
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

export async function batchSetPendingPrices(
  userId: number,
  updates: PendingPriceUpdate[],
  taskId?: string
): Promise<void> {
  for (const u of updates) {
    await setPendingPrice(userId, u.productId, u.pendingPrice, taskId);
  }
}

export async function getProductsWithPendingPrices(userId: number) {
  const result =
    await sql`SELECT * FROM products WHERE user_id = ${userId} AND pending_price IS NOT NULL`;
  return result.rows;
}

export async function batchConfirmPendingByTaskId(userId: number, taskId: string): Promise<void> {
  await sql`
    UPDATE products 
    SET current_price = pending_price, 
        pending_price = NULL, pending_task_id = NULL, pending_status = 'completed', pending_since = NULL
    WHERE user_id = ${userId} AND pending_task_id = ${taskId}
  `;
}

export async function migrateAddPendingColumns(): Promise<void> {
  // Add columns for pending price tracking
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pending_price INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pending_task_id BIGINT`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pending_status VARCHAR(50)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP`;

  // Add columns for Unit Economics and Marketplace stats
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(255)`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_buyer_price INTEGER DEFAULT 0`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace_discount_percent INTEGER DEFAULT 0`;

  // Ensure price_rules table exists for Smart Repricing
  await sql`
    CREATE TABLE IF NOT EXISTS price_rules (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      product_id TEXT NOT NULL,
      min_price INTEGER DEFAULT 0,
      max_price INTEGER DEFAULT 0,
      target_margin NUMERIC(5,2) DEFAULT 15,
      auto_adjust BOOLEAN DEFAULT false,
      competitor_tracking BOOLEAN DEFAULT false,
      competitor_nmids TEXT,
      price_match_strategy TEXT DEFAULT 'none',
      undercut_amount NUMERIC(10,2) DEFAULT 5,
      undercut_type TEXT DEFAULT 'percent',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )
  `;

  // Add missing columns if table already exists
  await sql`ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS target_margin NUMERIC(5,2) DEFAULT 15`;
  await sql`ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS price_match_strategy TEXT DEFAULT 'none'`;
  await sql`ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS undercut_amount NUMERIC(10,2) DEFAULT 5`;
  await sql`ALTER TABLE price_rules ADD COLUMN IF NOT EXISTS undercut_type TEXT DEFAULT 'percent'`;
}

export async function clearChatHistory(userId: number): Promise<void> {
  await sql`UPDATE chat_history SET messages = '[]', updated_at = NOW() WHERE user_id = ${userId}`;
}

/**
 * Save products (bulk upsert)
 */
export async function saveProducts(userId: number, products: Partial<DBProduct>[]): Promise<void> {
  return productRepository.saveBatch(userId, products);
}

/**
 * Update product monitoring
 */
export async function updateProductMonitoring(
  userId: number,
  productId: string,
  isMonitored: boolean,
  minPrice?: number
): Promise<void> {
  if (minPrice !== undefined) {
    await sql`
      UPDATE products 
      SET is_monitored = ${isMonitored}, min_price = ${minPrice}, updated_at = NOW() 
      WHERE user_id = ${userId} AND product_id = ${productId}
    `;
  } else {
    await sql`
      UPDATE products 
      SET is_monitored = ${isMonitored}, updated_at = NOW() 
      WHERE user_id = ${userId} AND product_id = ${productId}
    `;
  }
}

/**
 * Log sentinel action
 */
export async function logSentinelAction(log: {
  user_id: number;
  product_id: string;
  product_title: string;
  detected_price: number;
  min_price: number;
  defense_action: string;
  saved_amount: number;
  marketplace: string;
  threat_type?: string;
  success?: boolean;
  details?: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO sentinel_logs (
      user_id, product_id, product_title, detected_price, 
      min_price, defense_action, saved_amount, marketplace, threat_type, success, details
    )
    VALUES (
      ${log.user_id}, ${log.product_id}, ${log.product_title}, ${log.detected_price},
      ${log.min_price}, ${log.defense_action}, ${log.saved_amount}, ${log.marketplace},
      ${log.threat_type || null}, ${log.success !== undefined ? log.success : true},
      ${log.details ? JSON.stringify(log.details) : '{}'}
    )
  `;
}

/**
 * Get active users for sentinel
 */
export async function getActiveUsersForSentinel() {
  const result = await sql`
    SELECT * FROM users 
    WHERE is_active = true 
      AND (protection_enabled = true OR subscription_active = true)
  `;
  return (result.rows as TelegramUser[]).map(decryptUser);
}

/**
 * Get all users for admin
 */
export async function getAllUsers(): Promise<TelegramUser[]> {
  const result = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return (result.rows as TelegramUser[]).map(decryptUser);
}

/**
 * Manage chat history
 */
export async function saveChatHistory(userId: number, messages: ChatMessage[]): Promise<void> {
  await sql`
    INSERT INTO chat_history (user_id, messages, updated_at)
    VALUES (${userId}, ${JSON.stringify(messages)}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      messages = EXCLUDED.messages,
      updated_at = NOW()
  `;
}

export async function getChatHistory(userId: number): Promise<ChatMessage[]> {
  const result = await sql`SELECT messages FROM chat_history WHERE user_id = ${userId}`;
  return result.rows[0]?.messages || [];
}

/**
 * Upsert marketplace orders
 */
export async function upsertMarketplaceOrders(userId: number, orders: MarketplaceOrder[]) {
  let inserted = 0;
  let updated = 0;

  // Process in batches or one by one
  for (const order of orders) {
    try {
      const result = await sql`
        INSERT INTO marketplace_orders (
          user_id, account_id, marketplace, order_id, 
          product_id, marketplace_product_id, title,
          order_date, status, price_total, quantity,
          commission, logistics, cost_price, region,
          updated_at
        )
        VALUES (
          ${userId}, ${order.account_id || null}, ${order.marketplace}, ${order.order_id},
          ${order.product_id || null}, ${order.marketplace_product_id}, ${order.title},
          ${order.order_date.toISOString()}, ${order.status}, ${order.price_total}, ${order.quantity},
          ${order.commission}, ${order.logistics}, ${order.cost_price}, ${order.region || null},
          NOW()
        )
        ON CONFLICT (user_id, marketplace, order_id) 
        DO UPDATE SET
          status = EXCLUDED.status,
          price_total = EXCLUDED.price_total,
          commission = EXCLUDED.commission,
          logistics = EXCLUDED.logistics,
          cost_price = EXCLUDED.cost_price,
          account_id = COALESCE(EXCLUDED.account_id, marketplace_orders.account_id),
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `;

      if (result.rows[0]?.inserted) inserted++;
      else updated++;
    } catch (e) {
      console.error(`Error upserting order ${order.order_id}:`, e);
    }
  }

  return { inserted, updated };
}

/**
 * Get sales history for analytics
 */
export async function getSalesHistory(
  userId: number,
  dateFrom: Date,
  dateTo: Date,
  accountId?: number
) {
  if (accountId) {
    const result = await sql`
      SELECT * FROM marketplace_orders
      WHERE user_id::text = ${userId}::text
        AND account_id = ${accountId}
        AND order_date >= ${dateFrom.toISOString()}
        AND order_date <= ${dateTo.toISOString()}
      ORDER BY order_date DESC
    `;
    return result.rows;
  }

  const result = await sql`
    SELECT * FROM marketplace_orders
    WHERE user_id = ${userId}
      AND order_date >= ${dateFrom.toISOString()}
      AND order_date <= ${dateTo.toISOString()}
    ORDER BY order_date DESC
  `;
  return result.rows;
}

export const getUserInfoByTelegramId = getUserById;
