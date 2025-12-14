// ============================================
// NeuroGUARDIAN — Vercel Postgres Database
// ============================================

import { sql } from '@vercel/postgres';

// ============================================
// SCHEMA INITIALIZATION
// ============================================

export async function initializeDatabase() {
  try {
    // Create users table
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
        auto_renew BOOLEAN DEFAULT true,
        payment_method_id VARCHAR(255),
        total_products INTEGER DEFAULT 0,
        triggered_today INTEGER DEFAULT 0,
        triggered_all_time INTEGER DEFAULT 0,
        saved_amount DECIMAL(12, 2) DEFAULT 0,
        referral_code VARCHAR(50) UNIQUE,
        referred_by BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id VARCHAR(255) NOT NULL,
        nm_id BIGINT,
        offer_id VARCHAR(255),
        vendor_code VARCHAR(255),
        barcode VARCHAR(255),
        title VARCHAR(500) NOT NULL,
        image_url TEXT,
        brand VARCHAR(255),
        category VARCHAR(255),
        current_price INTEGER NOT NULL,
        min_price INTEGER DEFAULT 0,
        original_price INTEGER,
        current_stock INTEGER DEFAULT 0,
        marketplace VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        is_monitored BOOLEAN DEFAULT true,
        trigger_count INTEGER DEFAULT 0,
        saved_amount DECIMAL(12, 2) DEFAULT 0,
        last_checked_at TIMESTAMP,
        last_triggered_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `;

    // Create transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(255) PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        yookassa_payment_id VARCHAR(255) UNIQUE,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'RUB',
        status VARCHAR(50) NOT NULL,
        plan VARCHAR(50) NOT NULL,
        payment_method VARCHAR(50),
        description TEXT,
        metadata JSONB DEFAULT '{}',
        promo_code VARCHAR(50),
        discount_amount DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP,
        refunded_at TIMESTAMP
      )
    `;

    // Create logs table
    await sql`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'info',
        title VARCHAR(255) NOT NULL,
        message TEXT,
        product_id VARCHAR(255),
        transaction_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_active, subscription_end)`;

    console.log('✅ Database initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// ============================================
// USER OPERATIONS
// ============================================

export interface User {
  id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  api_key_wb: string | null;
  api_key_ozon: string | null;
  ozon_client_id: string | null;
  protection_enabled: boolean;
  defense_mode: 'zero_stock' | 'price_correction';
  subscription_plan: 'trial' | 'basic' | 'pro' | null;
  subscription_end: Date | null;
  subscription_active: boolean;
  auto_renew: boolean;
  payment_method_id: string | null;
  total_products: number;
  triggered_today: number;
  triggered_all_time: number;
  saved_amount: number;
  referral_code: string | null;
  referred_by: number | null;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
}

export async function getUserById(userId: number): Promise<User | null> {
  const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return result.rows[0] as User | null;
}

export async function createUser(user: {
  id: number;
  username?: string | null;
  first_name: string;
  last_name?: string | null;
  photo_url?: string | null;
}): Promise<User> {
  // Generate unique referral code
  const referralCode = `NG${user.id.toString(36).toUpperCase()}`;
  
  const result = await sql`
    INSERT INTO users (id, username, first_name, last_name, photo_url, referral_code)
    VALUES (${user.id}, ${user.username || null}, ${user.first_name}, ${user.last_name || null}, ${user.photo_url || null}, ${referralCode})
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      photo_url = EXCLUDED.photo_url,
      last_active_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return result.rows[0] as User;
}

export async function updateUser(
  userId: number,
  updates: Partial<Omit<User, 'id' | 'created_at'>>
): Promise<User | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Build dynamic update query
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(userId);

  const query = `
    UPDATE users SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await sql.query(query, values);
  return result.rows[0] as User | null;
}

export async function setUserApiKey(
  userId: number,
  marketplace: 'WB' | 'Ozon',
  apiKey: string,
  clientId?: string
): Promise<void> {
  if (marketplace === 'WB') {
    await sql`UPDATE users SET api_key_wb = ${apiKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;
  } else {
    await sql`UPDATE users SET api_key_ozon = ${apiKey}, ozon_client_id = ${clientId || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;
  }
}

export async function activateSubscription(
  userId: number,
  plan: 'trial' | 'basic' | 'pro',
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

// ============================================
// PRODUCT OPERATIONS
// ============================================

export interface Product {
  id: number;
  user_id: number;
  product_id: string;
  nm_id: number | null;
  offer_id: string | null;
  vendor_code: string | null;
  barcode: string | null;
  title: string;
  image_url: string | null;
  brand: string | null;
  category: string | null;
  current_price: number;
  min_price: number;
  original_price: number | null;
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
  status: 'active' | 'protected' | 'triggered' | 'disabled';
  is_monitored: boolean;
  trigger_count: number;
  saved_amount: number;
  last_checked_at: Date | null;
  last_triggered_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getProductsByUserId(userId: number): Promise<Product[]> {
  const result = await sql`
    SELECT * FROM products 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return result.rows as Product[];
}

export async function getProductById(productId: string, userId: number): Promise<Product | null> {
  const result = await sql`
    SELECT * FROM products 
    WHERE product_id = ${productId} AND user_id = ${userId}
  `;
  return result.rows[0] as Product | null;
}

export async function upsertProduct(product: {
  user_id: number;
  product_id: string;
  nm_id?: number | null;
  offer_id?: string | null;
  vendor_code?: string | null;
  barcode?: string | null;
  title: string;
  image_url?: string | null;
  brand?: string | null;
  category?: string | null;
  current_price: number;
  min_price?: number;
  original_price?: number | null;
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
}): Promise<Product> {
  const result = await sql`
    INSERT INTO products (
      user_id, product_id, nm_id, offer_id, vendor_code, barcode,
      title, image_url, brand, category,
      current_price, min_price, original_price, current_stock, marketplace
    ) VALUES (
      ${product.user_id}, ${product.product_id}, ${product.nm_id || null}, 
      ${product.offer_id || null}, ${product.vendor_code || null}, ${product.barcode || null},
      ${product.title}, ${product.image_url || null}, ${product.brand || null}, ${product.category || null},
      ${product.current_price}, ${product.min_price || 0}, ${product.original_price || null},
      ${product.current_stock}, ${product.marketplace}
    )
    ON CONFLICT (user_id, product_id) DO UPDATE SET
      nm_id = EXCLUDED.nm_id,
      offer_id = EXCLUDED.offer_id,
      vendor_code = EXCLUDED.vendor_code,
      barcode = EXCLUDED.barcode,
      title = EXCLUDED.title,
      image_url = EXCLUDED.image_url,
      brand = EXCLUDED.brand,
      category = EXCLUDED.category,
      current_price = EXCLUDED.current_price,
      original_price = EXCLUDED.original_price,
      current_stock = EXCLUDED.current_stock,
      updated_at = CURRENT_TIMESTAMP,
      last_checked_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return result.rows[0] as Product;
}

export async function updateProductMinPrice(
  userId: number,
  productId: string,
  minPrice: number
): Promise<void> {
  await sql`
    UPDATE products SET 
      min_price = ${minPrice},
      status = CASE WHEN ${minPrice} > 0 THEN 'protected' ELSE 'active' END,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

export async function getProductsForProtection(userId: number): Promise<Product[]> {
  const result = await sql`
    SELECT * FROM products 
    WHERE user_id = ${userId} 
      AND is_monitored = true 
      AND min_price > 0
      AND status != 'disabled'
  `;
  return result.rows as Product[];
}

export async function recordDefenseTrigger(
  userId: number,
  productId: string,
  savedAmount: number
): Promise<void> {
  await sql`
    UPDATE products SET 
      status = 'triggered',
      trigger_count = trigger_count + 1,
      saved_amount = saved_amount + ${savedAmount},
      last_triggered_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;

  await sql`
    UPDATE users SET 
      triggered_today = triggered_today + 1,
      triggered_all_time = triggered_all_time + 1,
      saved_amount = saved_amount + ${savedAmount},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

// ============================================
// TRANSACTION OPERATIONS
// ============================================

export interface Transaction {
  id: string;
  user_id: number;
  yookassa_payment_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled' | 'refunded';
  plan: 'trial' | 'basic' | 'pro';
  payment_method: string | null;
  description: string | null;
  metadata: Record<string, any>;
  promo_code: string | null;
  discount_amount: number;
  created_at: Date;
  paid_at: Date | null;
  refunded_at: Date | null;
}

export async function createTransaction(transaction: {
  id: string;
  user_id: number;
  amount: number;
  currency?: string;
  plan: 'trial' | 'basic' | 'pro';
  description?: string;
  promo_code?: string;
  discount_amount?: number;
}): Promise<Transaction> {
  const result = await sql`
    INSERT INTO transactions (id, user_id, amount, currency, status, plan, description, promo_code, discount_amount)
    VALUES (
      ${transaction.id}, ${transaction.user_id}, ${transaction.amount}, 
      ${transaction.currency || 'RUB'}, 'pending', ${transaction.plan},
      ${transaction.description || null}, ${transaction.promo_code || null}, ${transaction.discount_amount || 0}
    )
    RETURNING *
  `;
  return result.rows[0] as Transaction;
}

export async function updateTransactionStatus(
  transactionId: string,
  status: Transaction['status'],
  yookassaPaymentId?: string,
  paymentMethod?: string
): Promise<void> {
  await sql`
    UPDATE transactions SET
      status = ${status},
      yookassa_payment_id = COALESCE(${yookassaPaymentId || null}, yookassa_payment_id),
      payment_method = COALESCE(${paymentMethod || null}, payment_method),
      paid_at = CASE WHEN ${status} = 'succeeded' THEN CURRENT_TIMESTAMP ELSE paid_at END,
      refunded_at = CASE WHEN ${status} = 'refunded' THEN CURRENT_TIMESTAMP ELSE refunded_at END
    WHERE id = ${transactionId}
  `;
}

export async function getTransactionById(transactionId: string): Promise<Transaction | null> {
  const result = await sql`SELECT * FROM transactions WHERE id = ${transactionId}`;
  return result.rows[0] as Transaction | null;
}

export async function getTransactionByYookassaId(yookassaPaymentId: string): Promise<Transaction | null> {
  const result = await sql`SELECT * FROM transactions WHERE yookassa_payment_id = ${yookassaPaymentId}`;
  return result.rows[0] as Transaction | null;
}

// ============================================
// LOG OPERATIONS
// ============================================

export async function createLog(log: {
  user_id: number;
  type: string;
  severity?: string;
  title: string;
  message?: string;
  product_id?: string;
  transaction_id?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await sql`
    INSERT INTO logs (user_id, type, severity, title, message, product_id, transaction_id, metadata)
    VALUES (
      ${log.user_id}, ${log.type}, ${log.severity || 'info'}, ${log.title},
      ${log.message || null}, ${log.product_id || null}, ${log.transaction_id || null},
      ${JSON.stringify(log.metadata || {})}
    )
  `;
}

export async function getLogsByUserId(userId: number, limit = 50): Promise<any[]> {
  const result = await sql`
    SELECT * FROM logs 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

// ============================================
// DAILY RESET
// ============================================

export async function resetDailyCounters(): Promise<void> {
  await sql`UPDATE users SET triggered_today = 0, updated_at = CURRENT_TIMESTAMP`;
}

// ============================================
// ACTIVE USERS FOR SENTINEL
// ============================================

export async function getActiveUsersForProtection(): Promise<User[]> {
  const result = await sql`
    SELECT * FROM users 
    WHERE is_active = true 
      AND protection_enabled = true
      AND subscription_active = true
      AND api_key_wb IS NOT NULL
  `;
  return result.rows as User[];
}
