// ============================================
// NeuroGUARDIAN — Database Service
// Handles all PostgreSQL operations via @vercel/postgres
// Version: 2.1.0 | Date: December 2024
// ============================================

// Use local pg driver for local development, @vercel/postgres for production
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sql: any;

if (process.env.VERCEL) {
  const { sql: vercelSql } = await import('@vercel/postgres');
  sql = vercelSql;
} else {
  const { sql: localSql } = await import('./database.local.js');
  sql = localSql;
}

export { sql };

import { logger } from '../lib/index.js';
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

  // 4. Transactions
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

  logger.info('Database schema initialized');
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<TelegramUser | null> {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`;
  return (result.rows[0] as TelegramUser) || null;
}

/**
 * Create or update user
 */
export async function createOrUpdateUser(user: Partial<TelegramUser>): Promise<TelegramUser> {
  const result = await sql`
    INSERT INTO users (
      id, username, first_name, last_name, photo_url,
      api_key_wb, api_key_ozon, ozon_client_id, updated_at
    )
    VALUES (
      ${user.id}, ${user.username || null}, ${user.first_name}, 
      ${user.last_name || null}, ${user.photo_url || null},
      ${user.api_key_wb || null}, ${user.api_key_ozon || null}, 
      ${user.ozon_client_id || null}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      photo_url = EXCLUDED.photo_url,
      updated_at = NOW()
    RETURNING *
  `;
  return result.rows[0] as TelegramUser;
}

export async function setProtectionEnabled(id: number, enabled: boolean): Promise<void> {
  await sql`UPDATE users SET protection_enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`;
}

export async function setDefenseMode(
  id: number,
  mode: 'zero_stock' | 'price_correction'
): Promise<void> {
  await sql`UPDATE users SET defense_mode = ${mode}, updated_at = NOW() WHERE id = ${id}`;
}

/**
 * Get user's products
 */
export async function getProductsByUserId(userId: number, accountId?: number) {
  if (accountId) {
    const result = await sql`
      SELECT * FROM products 
      WHERE user_id = ${userId} AND account_id = ${accountId}
      ORDER BY created_at DESC
    `;
    return result.rows;
  }

  const result = await sql`
    SELECT * FROM products 
    WHERE user_id = ${userId} 
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function updateProductMinPrice(
  userId: number,
  productId: string,
  minPrice: number
): Promise<void> {
  await sql`UPDATE products SET min_price = ${minPrice}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
}

export async function updateProductCostPrice(
  userId: number,
  productId: string,
  costPrice: number
): Promise<void> {
  await sql`UPDATE products SET cost_price = ${costPrice}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
}

export async function batchUpdateCostPrices(
  userId: number,
  updates: Array<{ productId: string; costPrice: number }>
): Promise<void> {
  for (const update of updates) {
    await updateProductCostPrice(userId, update.productId, update.costPrice);
  }
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
  await sql`UPDATE products SET current_price = ${price}, updated_at = NOW() WHERE user_id = ${userId} AND product_id = ${productId}`;
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
    AND subscription_end <= NOW() + (${days} || ' days')::interval
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
      auto_adjust BOOLEAN DEFAULT false,
      competitor_tracking BOOLEAN DEFAULT false,
      competitor_nmids TEXT,
      adjustment_type TEXT DEFAULT 'percent',
      adjustment_value NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )
  `;
}

export async function clearChatHistory(userId: number): Promise<void> {
  await sql`UPDATE chat_history SET messages = '[]', updated_at = NOW() WHERE user_id = ${userId}`;
}

/**
 * Save products (bulk upsert)
 */
export async function saveProducts(userId: number, products: Partial<DBProduct>[]): Promise<void> {
  for (const p of products) {
    await sql`
      INSERT INTO products (
        user_id, product_id, nm_id, official_sku, offer_id, title, 
        image_url, current_price, estimated_buyer_price, marketplace_discount_percent,
        current_stock, marketplace, account_id, updated_at
      )
      VALUES (
        ${userId}, ${p.product_id}, ${p.nm_id || null}, ${p.official_sku || null}, 
        ${p.offer_id || null}, ${p.title}, ${p.image_url}, ${p.current_price}, 
        ${p.estimated_buyer_price || null}, ${p.marketplace_discount_percent || null},
        ${p.current_stock}, ${p.marketplace}, ${p.account_id || null}, NOW()
      )
      ON CONFLICT (user_id, product_id) DO UPDATE SET
        current_price = EXCLUDED.current_price,
        estimated_buyer_price = EXCLUDED.estimated_buyer_price,
        marketplace_discount_percent = EXCLUDED.marketplace_discount_percent,
        current_stock = EXCLUDED.current_stock,
        title = EXCLUDED.title,
        image_url = EXCLUDED.image_url,
        account_id = COALESCE(EXCLUDED.account_id, products.account_id),
        updated_at = NOW()
    `;
  }
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
  return result.rows as TelegramUser[];
}

/**
 * Get all users for admin
 */
export async function getAllUsers(): Promise<TelegramUser[]> {
  const result = await sql`SELECT * FROM users ORDER BY created_at DESC`;
  return result.rows as TelegramUser[];
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
      WHERE user_id = ${userId}
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
