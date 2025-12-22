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

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_protection ON users(protection_enabled, subscription_active) WHERE protection_enabled = true`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_monitoring ON products(user_id, min_price) WHERE min_price > 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user ON sentinel_logs(user_id, created_at DESC)`;
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
  productId: number,
  minPrice: number
): Promise<void> {
  await sql`
    UPDATE products
    SET min_price = ${minPrice}, updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
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
  const result = await sql`
    SELECT * FROM users 
    WHERE subscription_active = true 
      AND subscription_end IS NOT NULL
      AND subscription_end < NOW() + INTERVAL '${daysUntilExpiry} days'
      AND (last_reminder_sent IS NULL OR last_reminder_sent < NOW() - INTERVAL '1 day')
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
