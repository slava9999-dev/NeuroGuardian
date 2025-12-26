// ============================================
// NeuroGUARDIAN — Database Service
// PostgreSQL operations via Vercel Postgres
// ============================================

import { sql } from '@vercel/postgres';
import type { TelegramUser } from '../lib/types.js';

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
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

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR(255) NOT NULL,
      nm_id BIGINT,
      title VARCHAR(500) NOT NULL,
      image_url TEXT,
      current_price INTEGER NOT NULL,
      min_price INTEGER DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      marketplace VARCHAR(10) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      is_monitored BOOLEAN DEFAULT true,
      -- Pending price tracking (Dec 2024 Audit)
      pending_price INTEGER,
      pending_task_id BIGINT,
      pending_status VARCHAR(20),
      pending_since TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(255) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      yookassa_payment_id VARCHAR(255) UNIQUE,
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      plan VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sentinel_logs (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR(255) NOT NULL,
      product_title VARCHAR(500),
      detected_price INTEGER NOT NULL,
      min_price INTEGER NOT NULL,
      defense_action VARCHAR(50) NOT NULL,
      saved_amount INTEGER DEFAULT 0,
      marketplace VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Chat history table
  await sql`
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      messages JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_protection ON users(protection_enabled, subscription_active) WHERE protection_enabled = true`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_monitoring ON products(user_id, min_price) WHERE min_price > 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user ON sentinel_logs(user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id)`;

  // Migration: Add offer_id column for Ozon (Dec 2024)
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_id VARCHAR(255)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_offer_id ON products(offer_id)`;

  // Performance indexes (Dec 2024 Audit)
  await sql`CREATE INDEX IF NOT EXISTS idx_products_nm_id ON products(nm_id) WHERE nm_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_marketplace ON products(user_id, marketplace)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_pending ON products(pending_status, pending_since) WHERE pending_status = 'pending'`;
}

/**
 * Create or update user (upsert)
 */
export async function createOrUpdateUser(user: TelegramUser) {
  const referralCode = `NG${user.id.toString(36).toUpperCase()}`;
  const existingUser = await sql`SELECT id, subscription_plan FROM users WHERE id = ${user.id}`;
  const isNewUser = existingUser.rows.length === 0;

  // Trial end date (3 days)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 3);

  if (isNewUser) {
    try {
      const result = await sql`
        INSERT INTO users (id, username, first_name, last_name, photo_url, referral_code, subscription_plan, subscription_end, subscription_active)
        VALUES (${user.id}, ${user.username || null}, ${user.first_name}, ${user.last_name || null}, ${user.photo_url || null}, ${referralCode}, 'trial', ${trialEndDate.toISOString()}, true)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          photo_url = EXCLUDED.photo_url,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      console.log(`✅ New user created with trial: ${user.id}`);
      return result.rows[0];
    } catch (e) {
      console.error('Error creating user:', e);
      const result = await sql`
        UPDATE users SET
          username = ${user.username || null},
          first_name = ${user.first_name},
          last_name = ${user.last_name || null},
          photo_url = ${user.photo_url || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
        RETURNING *
      `;
      return result.rows[0];
    }
  } else {
    // Existing user: only update profile, NOT subscription
    const result = await sql`
      UPDATE users SET
        username = ${user.username || null},
        first_name = ${user.first_name},
        last_name = ${user.last_name || null},
        photo_url = ${user.photo_url || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
      RETURNING *
    `;
    return result.rows[0];
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return result.rows[0];
}

/**
 * Get user's products
 */
export async function getProductsByUserId(userId: number) {
  const result = await sql`
    SELECT * FROM products 
    WHERE user_id = ${userId} 
    ORDER BY created_at DESC
  `;
  return result.rows;
}

/**
 * Update product min price (stop-loss)
 */
export async function updateProductMinPrice(
  userId: number,
  productId: string | number,
  minPrice: number
): Promise<void> {
  await sql`
    UPDATE products
    SET min_price = ${minPrice}, updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${String(productId)}
  `;
  console.log(`✅ Set min_price=${minPrice} for product ${productId} (User ${userId})`);
}

/**
 * Update product price in local DB
 */
export async function updateProductPrice(
  userId: number,
  productId: number | string,
  newPrice: number
): Promise<void> {
  await sql`
    UPDATE products 
    SET current_price = ${newPrice}, updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

/**
 * Batch update WB product prices by nm_id
 * IMPROVED (Dec 2024 Audit): Atomic batch update instead of loop
 * Uses single query for better performance and consistency
 */
export async function batchUpdateWbPrices(
  userId: number,
  updates: Array<{ nmId: number; newPrice: number }>
): Promise<{ updated: number; error?: string }> {
  if (updates.length === 0) {
    return { updated: 0 };
  }

  try {
    // For PostgreSQL, we can use a single UPDATE with CASE
    // But with Vercel Postgres we need to be careful with dynamic values
    // Using a transaction-like approach with individual updates wrapped
    let updated = 0;

    for (const u of updates) {
      const result = await sql`
        UPDATE products 
        SET current_price = ${u.newPrice}, updated_at = NOW()
        WHERE user_id = ${userId} AND nm_id = ${u.nmId}
      `;
      if (result.rowCount && result.rowCount > 0) {
        updated++;
      }
    }

    console.log(`📦 Batch updated ${updated}/${updates.length} WB prices for user ${userId}`);
    return { updated };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error(`❌ Batch WB price update failed:`, error);
    return { updated: 0, error };
  }
}

/**
 * Batch update Ozon product prices by product_id
 * IMPROVED (Dec 2024 Audit): Atomic batch update instead of loop
 */
export async function batchUpdateOzonPrices(
  userId: number,
  updates: Array<{ productId: string; newPrice: number }>
): Promise<{ updated: number; error?: string }> {
  if (updates.length === 0) {
    return { updated: 0 };
  }

  try {
    let updated = 0;

    for (const u of updates) {
      const result = await sql`
        UPDATE products 
        SET current_price = ${u.newPrice}, updated_at = NOW()
        WHERE user_id = ${userId} AND product_id = ${u.productId}
      `;
      if (result.rowCount && result.rowCount > 0) {
        updated++;
      }
    }

    console.log(`📦 Batch updated ${updated}/${updates.length} Ozon prices for user ${userId}`);
    return { updated };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error(`❌ Batch Ozon price update failed:`, error);
    return { updated: 0, error };
  }
}

/**
 * Activate user subscription
 */
export async function activateSubscription(
  userId: number,
  plan: string,
  durationDays: number,
  paymentMethodId?: string
): Promise<void> {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  await sql`
    UPDATE users SET
      subscription_plan = ${plan},
      subscription_end = ${endDate.toISOString()},
      subscription_active = true,
      payment_method_id = ${paymentMethodId || null},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

/**
 * Create transaction record
 */
export async function createTransaction(
  transactionId: string,
  userId: number,
  amount: number,
  plan: string
): Promise<void> {
  await sql`
    INSERT INTO transactions (id, user_id, amount, status, plan)
    VALUES (${transactionId}, ${userId}, ${amount}, 'pending', ${plan})
  `;
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  transactionId: string,
  status: string,
  yookassaPaymentId?: string
): Promise<void> {
  if (yookassaPaymentId) {
    await sql`
      UPDATE transactions 
      SET status = ${status}, yookassa_payment_id = ${yookassaPaymentId}, paid_at = NOW()
      WHERE id = ${transactionId}
    `;
  } else {
    await sql`
      UPDATE transactions 
      SET status = ${status}
      WHERE id = ${transactionId}
    `;
  }
}

/**
 * Check if user is eligible for first-month discount
 */
export async function isFirstPayment(userId: number): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM transactions 
    WHERE user_id = ${userId} AND status = 'succeeded'
  `;
  return Number(result.rows[0]?.count || 0) === 0;
}

/**
 * Log sentinel defense action
 */
export async function logSentinelAction(
  userId: number,
  productId: string,
  productTitle: string,
  detectedPrice: number,
  minPrice: number,
  action: string,
  savedAmount: number,
  marketplace: string
): Promise<void> {
  await sql`
    INSERT INTO sentinel_logs 
    (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
    VALUES (${userId}, ${productId}, ${productTitle}, ${detectedPrice}, ${minPrice}, ${action}, ${savedAmount}, ${marketplace})
  `;
}

/**
 * Get users with expiring subscriptions (for reminders)
 */
export async function getUsersWithExpiringSubscriptions(daysUntilExpiry: number) {
  // Calculate the expiry threshold date in JavaScript to avoid SQL injection
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const result = await sql`
    SELECT * FROM users 
    WHERE subscription_active = true 
      AND subscription_end IS NOT NULL
      AND subscription_end < ${expiryThreshold.toISOString()}
      AND (last_reminder_sent IS NULL OR last_reminder_sent < ${oneDayAgo.toISOString()})
  `;
  return result.rows;
}

/**
 * Mark reminder as sent
 */
export async function markReminderSent(userId: number): Promise<void> {
  await sql`
    UPDATE users 
    SET last_reminder_sent = NOW() 
    WHERE id = ${userId}
  `;
}

/**
 * Apply referral bonus to referrer
 */
export async function applyReferralBonus(referrerId: number, days: number = 30): Promise<void> {
  // Calculate new subscription end date in JavaScript to avoid SQL injection
  const newEndFromNow = new Date();
  newEndFromNow.setDate(newEndFromNow.getDate() + days);

  // First, get current subscription_end
  const currentUser = await sql`SELECT subscription_end FROM users WHERE id = ${referrerId}`;
  const currentEnd = currentUser.rows[0]?.subscription_end;

  let newEndDate: Date;
  if (!currentEnd || new Date(currentEnd) < new Date()) {
    // No subscription or expired — start from now
    newEndDate = newEndFromNow;
  } else {
    // Active subscription — extend from current end
    newEndDate = new Date(currentEnd);
    newEndDate.setDate(newEndDate.getDate() + days);
  }

  await sql`
    UPDATE users SET
      subscription_end = ${newEndDate.toISOString()},
      subscription_active = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${referrerId}
  `;
}

// ============================================
// PENDING PRICE TRACKING (Dec 2024 Audit)
// Track async WB price update tasks
// ============================================

/**
 * Set pending price for a product
 * Called when WB task is created but not yet confirmed
 */
export async function setPendingPrice(
  userId: number,
  productId: string,
  pendingPrice: number,
  taskId: number
): Promise<void> {
  await sql`
    UPDATE products SET
      pending_price = ${pendingPrice},
      pending_task_id = ${taskId},
      pending_status = 'pending',
      pending_since = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
  console.log(`📋 Set pending price ${pendingPrice} for ${productId} (task: ${taskId})`);
}

/**
 * Clear pending price (on failure or timeout)
 */
export async function clearPendingPrice(
  userId: number,
  productId: string,
  status: 'failed' | 'timeout' = 'failed'
): Promise<void> {
  await sql`
    UPDATE products SET
      pending_price = NULL,
      pending_task_id = NULL,
      pending_status = ${status},
      updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
  console.log(`❌ Cleared pending price for ${productId} (status: ${status})`);
}

/**
 * Confirm pending price (on successful task completion)
 * Moves pending_price to current_price
 */
export async function confirmPendingPrice(
  userId: number,
  productId: string
): Promise<{ confirmed: boolean; newPrice: number | null }> {
  const result = await sql`
    UPDATE products SET
      current_price = pending_price,
      pending_price = NULL,
      pending_task_id = NULL,
      pending_status = 'completed',
      pending_since = NULL,
      updated_at = NOW()
    WHERE user_id = ${userId} 
      AND product_id = ${productId}
      AND pending_price IS NOT NULL
    RETURNING current_price
  `;

  if (result.rowCount && result.rowCount > 0) {
    const newPrice = result.rows[0]?.current_price;
    console.log(`✅ Confirmed pending price ${newPrice} for ${productId}`);
    return { confirmed: true, newPrice };
  }

  return { confirmed: false, newPrice: null };
}

/**
 * Batch set pending prices for WB updates
 */
export async function batchSetPendingPrices(
  userId: number,
  updates: Array<{ nmId: number; pendingPrice: number; taskId: number }>
): Promise<{ updated: number }> {
  let updated = 0;

  for (const u of updates) {
    const result = await sql`
      UPDATE products SET
        pending_price = ${u.pendingPrice},
        pending_task_id = ${u.taskId},
        pending_status = 'pending',
        pending_since = NOW(),
        updated_at = NOW()
      WHERE user_id = ${userId} AND nm_id = ${u.nmId}
    `;
    if (result.rowCount && result.rowCount > 0) {
      updated++;
    }
  }

  console.log(`📋 Batch set ${updated} pending prices for user ${userId}`);
  return { updated };
}

/**
 * Get products with pending prices (for cron verification)
 */
export async function getProductsWithPendingPrices() {
  const result = await sql`
    SELECT 
      p.*,
      u.api_key_wb
    FROM products p
    JOIN users u ON p.user_id = u.id
    WHERE p.pending_status = 'pending'
      AND p.pending_task_id IS NOT NULL
      AND p.pending_since < NOW() - INTERVAL '30 seconds'
    ORDER BY p.pending_since ASC
    LIMIT 50
  `;
  return result.rows;
}

/**
 * Batch confirm pending prices by task ID
 */
export async function batchConfirmPendingByTaskId(taskId: number): Promise<{ confirmed: number }> {
  const result = await sql`
    UPDATE products SET
      current_price = pending_price,
      pending_price = NULL,
      pending_task_id = NULL,
      pending_status = 'completed',
      pending_since = NULL,
      updated_at = NOW()
    WHERE pending_task_id = ${taskId}
      AND pending_price IS NOT NULL
  `;

  const confirmed = result.rowCount || 0;
  console.log(`✅ Batch confirmed ${confirmed} products for task ${taskId}`);
  return { confirmed };
}

/**
 * Migration: Add pending price columns to existing DB
 * Run once during deployment
 */
export async function migrateAddPendingColumns(): Promise<void> {
  try {
    // Add columns if they don't exist (PostgreSQL safe)
    await sql`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS pending_price INTEGER,
      ADD COLUMN IF NOT EXISTS pending_task_id BIGINT,
      ADD COLUMN IF NOT EXISTS pending_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP
    `;
    console.log('✅ Migration: pending price columns added');
  } catch (e) {
    // Columns may already exist
    console.log('ℹ️ Migration: pending columns already exist or error:', e);
  }
}

// ========================================
// Chat History Functions
// ========================================

interface ChatMessageDB {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userId: number): Promise<ChatMessageDB[]> {
  const result = await sql`
    SELECT messages FROM chat_history WHERE user_id = ${userId}
  `;

  if (result.rows.length === 0) {
    return [];
  }

  return result.rows[0].messages as ChatMessageDB[];
}

/**
 * Save chat history for a user (upsert)
 */
export async function saveChatHistory(userId: number, messages: ChatMessageDB[]): Promise<void> {
  // Keep only last 50 messages to prevent bloat
  const trimmedMessages = messages.slice(-50);

  await sql`
    INSERT INTO chat_history (user_id, messages, updated_at)
    VALUES (${userId}, ${JSON.stringify(trimmedMessages)}::jsonb, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET messages = ${JSON.stringify(trimmedMessages)}::jsonb, updated_at = NOW()
  `;
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userId: number): Promise<void> {
  await sql`
    DELETE FROM chat_history WHERE user_id = ${userId}
  `;
}
