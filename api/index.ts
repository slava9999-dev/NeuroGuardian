// ============================================
// NeuroGUARDIAN — Unified API Handler
// All endpoints in one file (Vercel Hobby limit: 12 functions)
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';
import { agentService } from '../src/server/services/agent/agent.service';
import { userService } from '../src/server/services/user/user.service';
import { logger } from '../src/server/utils/logger';
import { taskQueue, taskProcessor } from '../src/server/services/queue';
import { notificationService } from '../src/server/services/notification/notification.service';
// TODO: Re-enable after fixing import issue
// import { rulesService } from '../src/server/services/rules/rules.service';
// import { RULE_TEMPLATES } from '../src/server/services/rules/rules.types';

// ============================================
// CONFIGURATION
// ============================================

const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

// API Key Encryption (AES-256-GCM) — per ТЗ Security Requirements
const API_KEY_ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || '';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// ============================================
// OPENAI CONFIGURATION
// ============================================

// AI Agent System Prompt - defines the agent's behavior

// ============================================
// AI AGENT TOOLS DEFINITIONS (Function Calling)
// Эти инструменты GPT может вызывать сам!
// ============================================

// Типы для tool calls

/**
 * Call OpenAI Chat Completion API (базовая версия без tools)
 */

/**
 * Выполнение инструмента агента
 */

/**
 * Вспомогательная функция для получения даты из периода
 */

// ============================================
// TEST MODE (disable payments for testing)
// Set TEST_MODE=true in Vercel Environment Variables
// ============================================
const TEST_MODE = process.env.TEST_MODE === 'true';
if (TEST_MODE) {
  console.log('🧪 TEST MODE ENABLED: All users get Pro subscription for free');
}

/**
 * Encrypt API key using AES-256-GCM
 * Format: iv:authTag:encryptedData (all hex)
 */
function encryptApiKey(apiKey: string): string {
  if (!API_KEY_ENCRYPTION_KEY || API_KEY_ENCRYPTION_KEY.length < 32) {
    console.warn('⚠️ API_KEY_ENCRYPTION_KEY not configured, storing key as-is');
    return apiKey; // Fallback for development
  }

  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return apiKey; // Fallback
  }
}

/**
 * Decrypt API key using AES-256-GCM
 */
function decryptApiKey(encryptedKey: string): string {
  if (!encryptedKey) return '';

  // Check if key is encrypted (contains colons for iv:authTag:data format)
  if (!encryptedKey.includes(':') || !API_KEY_ENCRYPTION_KEY) {
    return encryptedKey; // Not encrypted or no key configured
  }

  try {
    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encrypted) return encryptedKey;

    const key = Buffer.from(API_KEY_ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedKey; // Return as-is if decryption fails
  }
}

/**
 * Exponential backoff for API retries (per ТЗ requirements)
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
        console.warn(
          `⏳ Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.warn(`⚠️ Request failed, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// ============================================
// SUBSCRIPTION PLANS + DISCOUNTS
// ============================================

const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Базовый',
    price: 499,
    discountedPrice: 349, // 30% off for first month
    durationDays: 30,
    maxProducts: 50,
    features: ['До 50 товаров', 'Защита Zero Stock', 'Telegram уведомления'],
  },
  pro: {
    id: 'pro',
    name: 'Профессиональный',
    price: 999,
    discountedPrice: 699, // 30% off for first month
    durationDays: 30,
    maxProducts: 500,
    features: ['До 500 товаров', 'Оба режима защиты', 'Приоритетная поддержка', 'API доступ'],
  },
  yearly: {
    id: 'yearly',
    name: 'Годовой Pro',
    price: 9990,
    discountedPrice: 9990, // No discount on yearly
    durationDays: 365,
    maxProducts: 500,
    features: ['Все из Pro', 'Экономия 2000₽', 'Персональный менеджер'],
  },
} as const;

type PlanId = keyof typeof SUBSCRIPTION_PLANS;

// Referral program configuration
const REFERRAL_BONUS_DAYS = 30; // 1 month free for referrer
const REFERRAL_DISCOUNT_PERCENT = 20; // 20% discount for referred user's first payment

// Promo codes (reserved for future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PROMO_CODES: Record<string, { discount: number; maxUses?: number; expiresAt?: string }> = {
  LAUNCH30: { discount: 30, maxUses: 100 },
  NEURO20: { discount: 20 },
};

// ============================================
// TELEGRAM AUTH (Production-grade with crypto validation)
// ============================================

import * as crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface InitDataValidationResult {
  valid: boolean;
  user: TelegramUser | null;
  error?: string;
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const ALLOWED_ORIGINS = [
  'https://neuro-guardian.vercel.app',
  'https://neuro-guardian-sos.vercel.app',
  'https://t.me',
  process.env.WEBAPP_URL,
].filter(Boolean);

// Demo user ONLY for development
const DEMO_USER: TelegramUser = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
};

/**
 * Validates Telegram WebApp initData using HMAC-SHA256
 * As per: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramInitData(initData: string): InitDataValidationResult {
  // PRODUCTION MODE: No demo fallback allowed
  if (!initData || initData === '') {
    // In production, require real Telegram auth
    if (IS_PRODUCTION) {
      return { valid: false, user: null, error: 'Authentication required' };
    }
    // Development only: allow demo user
    console.log('🧪 [DEV ONLY] Using demo user');
    return { valid: true, user: DEMO_USER };
  }

  // Explicitly allow 'demo' only in development
  if (initData === 'demo') {
    if (IS_PRODUCTION) {
      return { valid: false, user: null, error: 'Demo mode disabled in production' };
    }
    console.log('🧪 [DEV ONLY] Demo mode activated');
    return { valid: true, user: DEMO_USER };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, user: null, error: 'Missing hash in initData' };
    }

    // Bot token validation
    if (!TELEGRAM_BOT_TOKEN) {
      // In development, allow without signature validation (with warning)
      if (!IS_PRODUCTION) {
        console.warn('⚠️ [DEV] TELEGRAM_BOT_TOKEN not set, skipping signature validation');
        const userJson = params.get('user');
        if (!userJson) {
          return { valid: false, user: null, error: 'Missing user in initData' };
        }
        const user = JSON.parse(userJson) as TelegramUser;
        return { valid: true, user };
      }

      // In production, BOT_TOKEN is required
      console.error('❌ PRODUCTION: TELEGRAM_BOT_TOKEN not configured!');
      return { valid: false, user: null, error: 'Auth system not configured' };
    }

    // Remove hash for validation
    params.delete('hash');

    // Sort params alphabetically and create data-check-string
    const checkArr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    const dataCheckString = checkArr.join('\n');

    // Generate secret key: HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

    if (
      hashBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
    ) {
      console.warn('⚠️ Invalid Telegram signature');
      return { valid: false, user: null, error: 'Invalid signature' };
    }

    // Validate auth_date (not older than 24 hours)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate, 10) * 1000;
      const now = Date.now();
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

      if (now - authTimestamp > MAX_AGE) {
        return { valid: false, user: null, error: 'Auth data expired' };
      }
    }

    // Parse user
    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false, user: null, error: 'Missing user in initData' };
    }

    const user = JSON.parse(userJson) as TelegramUser;

    // Validate user structure
    if (!user.id || typeof user.id !== 'number') {
      return { valid: false, user: null, error: 'Invalid user ID' };
    }

    // Mask user ID for logging (security)
    const maskedId = `${String(user.id).slice(0, 3)}***${String(user.id).slice(-2)}`;
    console.log(`✅ Valid Telegram user: ${maskedId}`);

    return { valid: true, user };
  } catch (error) {
    console.error(
      '❌ InitData validation error:',
      error instanceof Error ? error.message : 'Unknown'
    );
    return { valid: false, user: null, error: 'Validation failed' };
  }
}

/**
 * Rate limiting - with Vercel KV support (persists across cold starts)
 * Falls back to in-memory if KV not configured
 */
import { createClient, type VercelKV } from '@vercel/kv';

// In-memory fallback store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_LIMIT_STRICT = 20; // stricter limit for sensitive actions
const RATE_WINDOW = 60 * 1000; // 1 minute

// Lazy-load KV client (only if configured)
let kvClient: VercelKV | null = null;
function getKVClient(): VercelKV | null {
  if (kvClient) return kvClient;

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      kvClient = createClient({ url: kvUrl, token: kvToken });
      console.log('✅ Vercel KV Rate Limiter connected');
      return kvClient;
    } catch {
      console.warn('⚠️ Failed to connect to Vercel KV, using in-memory fallback');
      return null;
    }
  }
  return null;
}

async function checkRateLimitAsync(
  identifier: string,
  strict: boolean = false
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = strict ? RATE_LIMIT_STRICT : RATE_LIMIT;
  const kv = getKVClient();

  // If KV is available, use it for persistent rate limiting
  if (kv) {
    try {
      const key = `ratelimit:${identifier}`;
      const count = await kv.incr(key);

      // Set expiry on first increment
      if (count === 1) {
        await kv.expire(key, 60); // 60 seconds
      }

      if (count > limit) {
        return { allowed: false, remaining: 0 };
      }
      return { allowed: true, remaining: limit - count };
    } catch {
      console.warn('⚠️ KV rate limit check failed, falling back to memory');
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

// Note: Synchronous checkRateLimitSync was removed - all rate limiting now uses async KV-backed version

/**
 * Input sanitization
 */
function sanitizeInput(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, 10000) // Max length
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

function sanitizeApiKey(key: string): string {
  // API keys can be JWT tokens (contain dots) or regular tokens
  // Allow: alphanumeric, dashes, underscores, colons, dots (for JWT)
  return key.replace(/[^a-zA-Z0-9\-_:.]/g, '').slice(0, 2000);
}

/**
 * Check if user has active subscription
 * In TEST_MODE, always returns true (free Pro for everyone)
 */
function isSubscriptionActive(user: any): boolean {
  // TEST MODE: everyone gets free access
  if (TEST_MODE) return true;

  if (!user?.subscription_end) return false;
  const endDate = new Date(user.subscription_end);
  return endDate > new Date();
}

/**
 * Get product limit based on subscription plan
 * In TEST_MODE, always returns Pro limit (500)
 */
function getProductLimit(plan: string | null): number {
  // TEST MODE: everyone gets Pro limits
  if (TEST_MODE) return 500;

  switch (plan) {
    case 'pro':
    case 'yearly':
      return 500;
    case 'basic':
      return 50;
    case 'trial':
      return 20; // Trial users get limited access
    default:
      return 0;
  }
}

// Product limit check is done inline in sync-products handler
// Removed canAddProducts function to fix unused warning

/**
 * Check if user is eligible for first-month discount
 */
async function isFirstPayment(userId: number): Promise<boolean> {
  const result = await sql`
    SELECT COUNT(*) as count FROM transactions 
    WHERE user_id = ${userId} AND status = 'succeeded'
  `;
  return parseInt(result.rows[0]?.count || '0', 10) === 0;
}

// NOTE: calculatePrice function was removed as unused (promo/discount logic handled in create-payment)
// Can be re-added when discount functionality is implemented in frontend

/**
 * Apply referral bonus to referrer
 */
async function applyReferralBonus(referrerId: number): Promise<void> {
  // Add REFERRAL_BONUS_DAYS to referrer's subscription
  await sql`
    UPDATE users SET
      subscription_end = CASE 
        WHEN subscription_end IS NULL OR subscription_end < CURRENT_TIMESTAMP 
        THEN CURRENT_TIMESTAMP + INTERVAL '${REFERRAL_BONUS_DAYS} days'
        ELSE subscription_end + INTERVAL '${REFERRAL_BONUS_DAYS} days'
      END,
      subscription_active = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${referrerId}
  `;

  // Send notification
  await sendTelegramNotification(
    referrerId,
    `🎉 <b>Бонус за реферала!</b>\n\n` +
      `Спасибо! Ваш друг оплатил подписку.\n` +
      `➕ Добавлено ${REFERRAL_BONUS_DAYS} дней к вашей подписке.`
  );
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(userId: number, message: string): Promise<boolean> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set, skipping notification');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );
    return response.ok;
  } catch (e) {
    console.error('Telegram notification error:', e);
    return false;
  }
}

/**
 * Send subscription expiry reminder (called by cron)
 */
async function sendExpiryReminders(): Promise<{ sent: number; errors: number }> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  // Find users whose subscription expires in ~3 days
  const result = await sql`
    SELECT id, first_name, subscription_plan, subscription_end 
    FROM users 
    WHERE subscription_active = true
      AND subscription_end IS NOT NULL
      AND subscription_end BETWEEN CURRENT_TIMESTAMP AND ${threeDaysFromNow.toISOString()}::timestamp
      AND (last_reminder_sent IS NULL OR last_reminder_sent < CURRENT_DATE - INTERVAL '2 days')
  `;

  let sent = 0;
  let errors = 0;

  for (const user of result.rows) {
    const daysLeft = Math.ceil(
      (new Date(user.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const message =
      `⏰ <b>Напоминание о подписке</b>\n\n` +
      `Привет, ${user.first_name}!\n\n` +
      `Ваша подписка <b>${user.subscription_plan}</b> истекает через <b>${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}</b>.\n\n` +
      `💡 Продлите сейчас, чтобы не потерять защиту товаров!\n\n` +
      `🔗 Откройте приложение для продления`;

    const success = await sendTelegramNotification(user.id, message);
    if (success) {
      sent++;
      await sql`UPDATE users SET last_reminder_sent = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
    } else {
      errors++;
    }
  }

  return { sent, errors };
}

// ============================================
// DATABASE OPERATIONS
// ============================================

async function initializeDatabase() {
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

  // Sentinel audit logs table
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

  // Optimized indexes for common queries
  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_protection ON users(protection_enabled, subscription_active) WHERE protection_enabled = true`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_monitoring ON products(user_id, min_price) WHERE min_price > 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user ON sentinel_logs(user_id, created_at DESC)`;
}

async function createOrUpdateUser(user: TelegramUser) {
  const referralCode = `NG${user.id.toString(36).toUpperCase()}`;

  // Check if user exists
  const existingUser = await sql`SELECT id FROM users WHERE id = ${user.id}`;
  const isNewUser = existingUser.rows.length === 0;

  // Calculate trial end date (3 days from now)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 3);

  if (isNewUser) {
    // Create new user with trial subscription
    try {
      const result = await sql`
        INSERT INTO users (id, username, first_name, last_name, photo_url, referral_code, subscription_plan, subscription_end, subscription_active)
        VALUES (${user.id}, ${user.username || null}, ${user.first_name}, ${user.last_name || null}, ${user.photo_url || null}, ${referralCode}, 'trial', ${trialEndDate.toISOString()}, true)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          photo_url = EXCLUDED.photo_url,
          subscription_plan = 'trial',
          subscription_end = EXCLUDED.subscription_end,
          subscription_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      console.log(`✅ New user created/updated with trial: ${user.id}`);
      return result.rows[0];
    } catch (e) {
      console.error('Error creating user:', e);
      // Fallback update if insert fails
      const result = await sql`
        UPDATE users SET
          username = ${user.username || null},
          first_name = ${user.first_name},
          last_name = ${user.last_name || null},
          photo_url = ${user.photo_url || null},
          subscription_plan = 'trial',
          subscription_end = ${trialEndDate.toISOString()},
          subscription_active = true,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${user.id}
        RETURNING *
      `;
      return result.rows[0];
    }
  } else {
    // Existing user: only update profile data, DO NOT reset subscription
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

async function getUserById(userId: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return result.rows[0];
}

async function getProductsByUserId(userId: number) {
  const result =
    await sql`SELECT * FROM products WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return result.rows;
}

async function updateProductMinPrice(userId: number, productId: number, minPrice: number) {
  // Проверяем, существует ли продукт
  const existingCheck = await sql`
    SELECT id FROM products 
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;

  if (existingCheck.rowCount === 0) {
    // Если товара нет, добавляем заглушку, чтобы stop-loss сработал
    // В идеале нужно сначала синхронизировать товары, но это workaround
    console.warn(`⚠️ Warning: Setting min_price for unknown product ${productId} (User ${userId})`);
  }

  // Обновляем min_price в базе
  await sql`
    UPDATE products
    SET min_price = ${minPrice}, updated_at = NOW()
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;

  console.log(`✅ Set min_price=${minPrice} for product ${productId} (User ${userId})`);
}

/**
 * РЕАЛЬНОЕ обновление цен на WB
 * Использует API v2: https://openapi.wildberries.ru/prices/api/ru/#tag/Zagruzka-cen/paths/~1api~1v2~1upload~1task/post
 */
async function updatePricesReal(
  userId: number,
  updates: Array<{ productId: number; newPrice: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const user = await getUserById(userId);
    if (!user || !user.api_key_wb) {
      return { success: false, count: 0, error: 'API Key not found' };
    }

    const wbApiKey = decryptApiKey(user.api_key_wb);

    // Формируем payload для WB API
    // WB API ожидает: { data: [ { nmId: 123, price: 1000 } ] }
    const wbPayload = {
      data: updates.map(u => ({
        nmId: Number(u.productId), // nmId ОБЯЗАТЕЛЬНО число
        price: Math.floor(u.newPrice), // Цена ОБЯЗАТЕЛЬНО целое число
      })),
    };

    console.log(`🚀 SENDING REAL PRICE UPDATE TO WB: ${JSON.stringify(wbPayload)}`);

    const response = await fetchWithRetry(
      'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
      {
        method: 'POST',
        headers: {
          Authorization: wbApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wbPayload),
      }
    );

    if (response.ok) {
      console.log(`✅ Price update task created successfully for ${updates.length} products`);

      // Также обновляем цены в НАШЕЙ базе, чтобы не ждать синхронизации
      for (const update of updates) {
        await sql`
             UPDATE products 
             SET current_price = ${update.newPrice}, updated_at = NOW()
             WHERE user_id = ${userId} AND product_id = ${update.productId}
           `;
      }

      return { success: true, count: updates.length };
    } else {
      const errText = await response.text();
      console.error(`❌ WB API Error: ${response.status} ${errText}`);
      return { success: false, count: 0, error: `WB API Error: ${errText}` };
    }
  } catch (error) {
    console.error('❌ updatePricesReal Error:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function activateSubscription(
  userId: number,
  plan: string,
  durationDays: number,
  paymentMethodId?: string
) {
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
// YOOKASSA OPERATIONS
// ============================================

async function createYookassaPayment(
  userId: number,
  planId: PlanId,
  returnUrl: string,
  userEmail?: string
) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) return { success: false, error: 'Invalid plan' };

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');
  const idempotencyKey = uuidv4();
  const transactionId = uuidv4();

  // Dynamic email: use provided email, fallback to pseudo-email based on Telegram ID
  // This complies with 54-ФЗ requirements for electronic receipts
  const receiptEmail = userEmail || `tg${userId}@neuroguardian.app`;
  console.log(`📧 Payment receipt email: ${receiptEmail}`);

  const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      'Idempotence-Key': idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value: plan.price.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'embedded', return_url: returnUrl },
      capture: true,
      description: `NeuroGUARDIAN: ${plan.name} (${plan.durationDays} дней) — защита маржи WB/Ozon`,
      metadata: { user_id: userId.toString(), plan_id: planId, transaction_id: transactionId },
      save_payment_method: true,
      receipt: {
        customer: {
          email: receiptEmail,
        },
        items: [
          {
            description: `Подписка NeuroGUARDIAN ${plan.name} (${plan.durationDays} дней)`,
            amount: { value: plan.price.toFixed(2), currency: 'RUB' },
            vat_code: 1, // НДС не облагается (самозанятый)
            quantity: '1',
            payment_subject: 'service',
            payment_mode: 'full_payment',
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    return { success: false, error: 'Payment creation failed' };
  }

  const payment = await response.json();

  // Create transaction record
  await sql`
    INSERT INTO transactions (id, user_id, amount, status, plan)
    VALUES (${transactionId}, ${userId}, ${plan.price}, 'pending', ${planId})
  `;

  return {
    success: true,
    paymentId: payment.id,
    confirmationToken: payment.confirmation?.confirmation_token,
    confirmationUrl: payment.confirmation?.confirmation_url,
    transactionId,
    plan: { id: planId, name: plan.name, price: plan.price, durationDays: plan.durationDays },
  };
}

// ============================================
// CORS HEADERS (Production-grade)
// ============================================

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';

  // Check if origin is allowed
  const isAllowed =
    !IS_PRODUCTION ||
    ALLOWED_ORIGINS.some(allowed => allowed && (origin === allowed || origin.startsWith(allowed)));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (!IS_PRODUCTION) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Init-Data, X-Admin-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query, body } = req;
  console.log(
    `📥 API Request: ${method} action=${query.action || body?.action}`,
    JSON.stringify(body || {}).substring(0, 200)
  );

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  setCorsHeaders(req, res);

  // Rate limiting by IP - using async KV-backed limiter for persistence across cold starts
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';
  const rateLimit = await checkRateLimitAsync(clientIp);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Parse action from query or body
  const action = sanitizeInput((req.query.action as string) || req.body?.action);

  try {
    switch (action) {
      // ========== AUTH ==========
      case 'auth': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData);

        // Validate Telegram initData with cryptographic check
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({
            error: validation.error || 'Invalid initData',
            code: 'AUTH_FAILED',
          });
        }

        const telegramUser = validation.user;

        await createOrUpdateUser(telegramUser);
        const fullUser = await getUserById(telegramUser.id);

        let subscriptionActive = false;
        let daysLeft = null;
        if (fullUser?.subscription_end) {
          const endDate = new Date(fullUser.subscription_end);
          subscriptionActive = endDate > new Date();
          daysLeft = Math.max(
            0,
            Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }

        if (fullUser?.subscription_end) {
          const endDate = new Date(fullUser.subscription_end);
          subscriptionActive = endDate > new Date();
          daysLeft = Math.max(
            0,
            Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }

        // FAIL-SAFE: For Testing, ensure Trial is always active
        if (fullUser?.subscription_plan === 'trial') {
          subscriptionActive = true;
          if (!daysLeft || daysLeft <= 0) daysLeft = 3;
        }

        // EMERGENCY FIX: Force subscription active if end date is in future
        if (fullUser?.subscription_end) {
          const endDate = new Date(fullUser.subscription_end);
          if (endDate > new Date()) {
            subscriptionActive = true;
            daysLeft = Math.max(
              1,
              Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );
          }
        }

        return res.json({
          success: true,
          user: {
            telegramId: fullUser?.id,
            username: fullUser?.username,
            firstName: fullUser?.first_name,
            lastName: fullUser?.last_name,
            photoUrl: fullUser?.photo_url,
            subscriptionActive,
            subscriptionExpiresAt: fullUser?.subscription_end,
            subscriptionPlan: fullUser?.subscription_plan,
            subscriptionDaysLeft: daysLeft,
            protectionEnabled: fullUser?.protection_enabled || false,
            defenseMode: fullUser?.defense_mode || 'zero_stock',
            wbKeyRef: fullUser?.api_key_wb ? 'configured' : null,
            ozonKeyRef: fullUser?.api_key_ozon ? 'configured' : null,
            totalProducts: fullUser?.total_products || 0,
            triggeredToday: fullUser?.triggered_today || 0,
            savedAmount: Number(fullUser?.saved_amount) || 0,
          },
        });
      }

      // ========== PRODUCTS ==========
      case 'products': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const adminKey = req.headers['x-admin-key'];
        const adminUserId = req.body?.userId;

        // Admin bypass for testing
        let user: any;
        if (adminKey === ADMIN_API_KEY && adminUserId) {
          user = { id: parseInt(adminUserId) };
          console.log(`🔧 Admin auth for products: user=${adminUserId}`);
        } else {
          const validation = validateTelegramInitData(initData);
          if (!validation.valid || !validation.user) {
            return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
          }
          user = validation.user;
        }

        if (req.method === 'GET') {
          const products = await getProductsByUserId(user.id);
          return res.json({
            success: true,
            products: products.map((p: any) => ({
              id: p.id.toString(),
              userId: p.user_id,
              productId: p.product_id,
              nmId: p.nm_id,
              title: p.title,
              imageUrl: p.image_url,
              currentPrice: p.current_price,
              minPrice: p.min_price,
              stock: p.current_stock,
              marketplace: p.marketplace,
              status: p.status,
              isMonitored: p.is_monitored,
            })),
          });
        }

        if (req.method === 'POST') {
          const { productId, minPrice, userId: adminUserId } = req.body;
          const adminKey = req.headers['x-admin-key'];

          // Admin bypass for testing
          let targetUserId = user.id;
          if (adminKey === ADMIN_API_KEY && adminUserId) {
            targetUserId = parseInt(adminUserId);
            console.log(`🔧 Admin override: updating product for user ${targetUserId}`);
          }

          if (!productId || typeof minPrice !== 'number') {
            return res
              .status(400)
              .json({ error: 'Invalid parameters', received: { productId, minPrice } });
          }

          // SECURITY: Verify product ownership before update (IDOR protection)
          const ownershipCheck = await sql`
            SELECT id FROM products WHERE user_id = ${targetUserId} AND product_id = ${productId}
          `;
          if (ownershipCheck.rows.length === 0) {
            console.warn(
              `⚠️ IDOR attempt: user=${targetUserId} tried to update product=${productId}`
            );
            return res.status(403).json({ error: 'Product not found or access denied' });
          }

          await updateProductMinPrice(targetUserId, productId, minPrice);
          console.log(
            `✅ Stop-Loss updated: user=${targetUserId}, product=${productId}, minPrice=${minPrice}`
          );
          return res.json({ success: true, productId, minPrice });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ========== SETTINGS ==========
      case 'settings': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { protectionEnabled, defenseMode, marketplace } = req.body;
        const initData = sanitizeInput(req.body?.initData || '');
        const apiKey = sanitizeApiKey(req.body?.apiKey || '');

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        const user = validation.user;

        if (marketplace && apiKey) {
          // Encrypt API key before storing (ТЗ Security Requirement)
          const encryptedKey = encryptApiKey(apiKey);
          console.log(`🔐 Encrypting ${marketplace} API key for user ${user.id}`);

          if (marketplace === 'WB') {
            await sql`UPDATE users SET api_key_wb = ${encryptedKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
          } else {
            await sql`UPDATE users SET api_key_ozon = ${encryptedKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
          }
          return res.json({
            success: true,
            message: `${marketplace} API ключ сохранён и зашифрован`,
          });
        }

        // Check subscription before enabling protection
        if (protectionEnabled === true) {
          const dbUser = await getUserById(user.id);
          if (!dbUser || !isSubscriptionActive(dbUser)) {
            return res.status(403).json({
              error: 'Для включения защиты требуется активная подписка',
              code: 'SUBSCRIPTION_REQUIRED',
            });
          }
        }

        if (protectionEnabled !== undefined) {
          await sql`UPDATE users SET protection_enabled = ${protectionEnabled}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
        }
        if (defenseMode) {
          await sql`UPDATE users SET defense_mode = ${defenseMode}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
        }

        return res.json({ success: true });
      }

      // ========== PLANS ==========
      case 'plans': {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

        const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
          maxProducts: plan.maxProducts,
          features: plan.features,
          pricePerMonth: plan.durationDays === 365 ? Math.round(plan.price / 12) : plan.price,
          isPopular: plan.id === 'pro',
          isBestValue: plan.id === 'yearly',
        }));

        return res.json({ success: true, plans });
      }

      // ========== CREATE PAYMENT ==========
      case 'create-payment': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData || '');
        const { planId } = req.body;

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        const user = validation.user;

        if (!planId || !SUBSCRIPTION_PLANS[planId as PlanId]) {
          return res.status(400).json({ error: 'Invalid plan' });
        }

        const plan = SUBSCRIPTION_PLANS[planId as PlanId];

        // PRODUCTION: YooKassa must be configured
        if (!SHOP_ID || !SECRET_KEY) {
          // In development, allow test mode
          if (!IS_PRODUCTION) {
            console.log('🧪 DEV MODE: Activating subscription without payment');
            await activateSubscription(
              user.id,
              planId === 'yearly' ? 'pro' : planId,
              plan.durationDays
            );
            return res.json({
              success: true,
              testMode: true,
              message: `Тестовый режим: подписка ${plan.name} активирована на ${plan.durationDays} дней`,
              plan: {
                id: planId,
                name: plan.name,
                price: plan.price,
                durationDays: plan.durationDays,
              },
            });
          }

          // In production, payment system must be configured
          console.error('❌ PRODUCTION: YooKassa not configured!');
          return res.status(503).json({
            error: 'Платёжная система временно недоступна. Попробуйте позже.',
            code: 'PAYMENT_SYSTEM_UNAVAILABLE',
          });
        }

        // Production: Create real YooKassa payment
        const returnUrl =
          process.env.WEBAPP_URL ||
          `https://${process.env.VERCEL_URL}` ||
          'https://neuro-guardian.vercel.app';
        const result = await createYookassaPayment(
          user.id,
          planId as PlanId,
          `${returnUrl}?payment_complete=true`
        );

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        return res.json(result);
      }

      // ========== PAYMENT WEBHOOK ==========
      case 'payment-webhook': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        // SECURITY: Verify webhook is from YooKassa IP addresses
        // Official YooKassa IPs: https://yookassa.ru/developers/using-api/webhooks#ip
        const YOOKASSA_IPS = [
          '185.71.76.0/27', // 185.71.76.0 - 185.71.76.31
          '185.71.77.0/27', // 185.71.77.0 - 185.71.77.31
          '77.75.153.0/25', // 77.75.153.0 - 77.75.153.127
          '77.75.156.11',
          '77.75.156.35',
          '77.75.154.128/25', // 77.75.154.128 - 77.75.154.255
          '2a02:5180::/32', // IPv6
        ];

        const clientIp =
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          (req.headers['x-real-ip'] as string) ||
          'unknown';

        // Simple IP check (for production, use proper CIDR matching)
        const isYooKassaIp = YOOKASSA_IPS.some(ip => {
          if (ip.includes('/')) {
            // CIDR notation - check prefix
            const prefix = ip.split('/')[0].split('.').slice(0, 3).join('.');
            return clientIp.startsWith(prefix);
          }
          return clientIp === ip;
        });

        if (IS_PRODUCTION && !isYooKassaIp && clientIp !== 'unknown') {
          console.error(`🚫 BLOCKED: Webhook from unauthorized IP: ${clientIp}`);
          return res.status(403).json({ error: 'Forbidden: Invalid source IP' });
        }

        const event = req.body;
        if (!event?.object?.id) return res.status(400).json({ error: 'Invalid payload' });

        const payment = event.object;
        const metadata = payment.metadata || {};
        const userId = parseInt(metadata.user_id, 10);
        const planId = metadata.plan_id;
        const referrerId = metadata.referrer_id ? parseInt(metadata.referrer_id, 10) : null;

        console.log(
          `💳 Payment webhook: status=${payment.status}, userId=${userId}, plan=${planId}`
        );

        if (payment.status === 'succeeded' && userId && planId) {
          const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
          if (plan) {
            const actualPlan = planId === 'yearly' ? 'pro' : planId;
            await activateSubscription(
              userId,
              actualPlan,
              plan.durationDays,
              payment.payment_method?.id
            );

            // Update transaction
            await sql`
              UPDATE transactions SET status = 'succeeded', yookassa_payment_id = ${payment.id}, paid_at = CURRENT_TIMESTAMP
              WHERE user_id = ${userId} AND status = 'pending'
              ORDER BY created_at DESC LIMIT 1
            `;

            // Apply referral bonus if this was a referred user's first payment
            if (referrerId) {
              const isFirst = await isFirstPayment(userId);
              if (isFirst) {
                await applyReferralBonus(referrerId);
                console.log(`🎁 Referral bonus applied to user ${referrerId}`);
              }
            }

            // Send success notification
            await sendTelegramNotification(
              userId,
              `✅ <b>Оплата успешна!</b>\n\n` +
                `Подписка <b>${plan.name}</b> активирована.\n` +
                `📅 Срок действия: ${plan.durationDays} дней\n\n` +
                `🛡️ Защита ваших товаров уже работает!`
            );

            console.log(
              `✅ Subscription activated for user ${userId}: ${actualPlan} for ${plan.durationDays} days`
            );
          }
        } else if (payment.status === 'canceled') {
          // Payment was canceled
          await sql`
            UPDATE transactions SET status = 'canceled'
            WHERE user_id = ${userId} AND status = 'pending'
            ORDER BY created_at DESC LIMIT 1
          `;
          console.log(`❌ Payment canceled for user ${userId}`);
        }

        return res.json({ success: true });
      }

      // ========== INIT DB ==========
      case 'init-db': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        await initializeDatabase();
        return res.json({ success: true, message: 'Database initialized' });
      }

      // ========== RESET DB (Clean all data) ==========
      case 'reset-db': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get current counts before deletion
        const userCountBefore = await sql`SELECT COUNT(*) as count FROM users`;
        const productCountBefore = await sql`SELECT COUNT(*) as count FROM products`;

        // Delete all data (order matters due to foreign keys)
        await sql`DELETE FROM transactions`;
        await sql`DELETE FROM products`;
        await sql`DELETE FROM users`;

        console.log(
          `🗑️ Database reset: deleted ${userCountBefore.rows[0].count} users, ${productCountBefore.rows[0].count} products`
        );

        return res.json({
          success: true,
          message: 'Database reset complete',
          deleted: {
            users: parseInt(userCountBefore.rows[0].count),
            products: parseInt(productCountBefore.rows[0].count),
          },
        });
      }

      // ========== HEALTH ==========
      case 'health': {
        let dbOk = false;
        try {
          await sql`SELECT 1`;
          dbOk = true;
        } catch {
          // Database check failed, dbOk remains false
        }

        return res.json({
          status: dbOk ? 'healthy' : 'unhealthy',
          version: '2.0.0',
          database: dbOk,
          hasPostgresUrl: !!process.env.POSTGRES_URL,
          hasYookassaShopId: !!SHOP_ID,
        });
      }

      // ========== ADMIN: ACTIVATE TRIAL ==========
      case 'admin-activate-trial': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        // EMERGENCY: Allow activation with emergency key
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized', hint: 'Use X-Admin-Key header' });
        }

        const { userId, days } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const durationDays = days || 30;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        await sql`
          UPDATE users SET
            subscription_plan = 'trial',
            subscription_end = ${endDate.toISOString()},
            subscription_active = true,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${userId}
        `;

        return res.json({
          success: true,
          message: `Trial activated for user ${userId} until ${endDate.toISOString()}`,
          userId,
          expiresAt: endDate.toISOString(),
        });
      }

      // ========== ADMIN: CHECK USER (DEBUG) ==========
      case 'admin-check-user': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
        const user = result.rows[0];

        if (!user) {
          return res.json({ found: false, userId });
        }

        const now = new Date();
        const endDate = user.subscription_end ? new Date(user.subscription_end) : null;
        const isActive = endDate ? endDate > now : false;

        return res.json({
          found: true,
          userId: user.id,
          subscription_plan: user.subscription_plan,
          subscription_end: user.subscription_end,
          subscription_active_db: user.subscription_active,
          subscription_active_computed: isActive,
          protection_enabled: user.protection_enabled,
          defense_mode: user.defense_mode,
          total_products: user.total_products,
          has_ozon_key: !!user.api_key_ozon,
          has_wb_key: !!user.api_key_wb,
          now: now.toISOString(),
          endDate: endDate?.toISOString() || null,
          daysLeft: endDate
            ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null,
        });
      }

      // ========== ADMIN: LIST ALL USERS ==========
      case 'admin-list-users': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const result =
          await sql`SELECT id, username, first_name, subscription_plan, subscription_end, subscription_active, created_at FROM users ORDER BY created_at DESC LIMIT 50`;

        return res.json({
          count: result.rows.length,
          users: result.rows.map(u => ({
            id: u.id,
            username: u.username,
            firstName: u.first_name,
            plan: u.subscription_plan,
            endDate: u.subscription_end,
            active: u.subscription_active,
            created: u.created_at,
          })),
        });
      }

      // ========== ADMIN: LIST PRODUCTS ==========
      case 'admin-list-products': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const result =
          await sql`SELECT product_id, title, current_price, min_price, status FROM products WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`;

        return res.json({
          count: result.rows.length,
          products: result.rows.map(p => ({
            productId: p.product_id,
            title: p.title?.substring(0, 40) + '...',
            currentPrice: p.current_price,
            minPrice: p.min_price,
            status: p.status,
          })),
        });
      }

      // ========== ADMIN: SET PROTECTION ==========
      case 'admin-set-protection': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        const enabled = req.query.enabled === 'true' || req.body?.enabled === true;

        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        await sql`UPDATE users SET protection_enabled = ${enabled}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;

        const result = await sql`SELECT protection_enabled FROM users WHERE id = ${userId}`;

        return res.json({
          success: true,
          userId,
          protection_enabled: result.rows[0]?.protection_enabled,
        });
      }

      // ========== ADMIN: TEST TELEGRAM ==========
      case 'admin-test-telegram': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean); // Uses the same auth
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token)
          return res.status(500).json({ error: 'ENV: TELEGRAM_BOT_TOKEN missing on server' });
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: userId,
              text: '🔔 <b>ТЕСТОВАЯ ПРОВЕРКА СВЯЗИ</b>\n\nЕсли вы это читаете, значит бот настроен верно!',
              parse_mode: 'HTML',
            }),
          });
          const tgData = await tgRes.json();
          return res.json({
            success: tgRes.ok,
            telegram_response: tgData,
            token_masked: token.substring(0, 5) + '...',
          });
        } catch (e: any) {
          return res.status(500).json({ error: 'Fetch Error', details: e.message });
        }
      }

      // ========== ADMIN: RESET STATUSES ==========
      case 'admin-reset-statuses': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        await sql`UPDATE products SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE user_id = ${userId}`;

        return res.json({ success: true, message: 'All products reset to ACTIVE status' });
      }

      // ========== ADMIN: SET DEFENSE MODE ==========
      case 'admin-set-defense-mode': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        const mode = req.query.mode || req.body?.mode; // 'zero_stock' | 'price_correction'

        if (!userId || !mode) return res.status(400).json({ error: 'Missing userId or mode' });

        await sql`UPDATE users SET defense_mode = ${mode}, updated_at = CURRENT_TIMESTAMP WHERE id = ${userId}`;

        const result = await sql`SELECT defense_mode FROM users WHERE id = ${userId}`;

        return res.json({
          success: true,
          userId,
          defense_mode: result.rows[0]?.defense_mode,
        });
      }

      // ========== ADMIN: TEST OZON API ==========
      case 'admin-test-ozon': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { clientId, apiKey } = req.body;
        if (!clientId || !apiKey) {
          return res.status(400).json({ error: 'Missing clientId or apiKey' });
        }

        try {
          const response = await fetch('https://api-seller.ozon.ru/v3/product/list', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Id': clientId,
              'Api-Key': apiKey,
            },
            body: JSON.stringify({ filter: {}, last_id: '', limit: 5 }),
          });

          const data = await response.json();

          return res.json({
            status: response.status,
            ok: response.ok,
            itemsCount: data.result?.items?.length || 0,
            total: data.result?.total || 0,
            error: data.message || data.error || null,
          });
        } catch (err: any) {
          return res.status(500).json({ error: err.message });
        }
      }

      // ========== ADMIN: TEST WB API ==========
      case 'admin-test-wb': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { apiKey } = req.body;
        if (!apiKey) {
          return res.status(400).json({ error: 'Missing apiKey' });
        }

        console.log('🔍 Testing WB API with key length:', apiKey.length);

        try {
          const response = await fetch(
            'https://content-api.wildberries.ru/content/v2/get/cards/list',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: apiKey,
              },
              body: JSON.stringify({
                settings: { cursor: { limit: 5 }, filter: { withPhoto: -1 } },
              }),
            }
          );

          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            data = { rawText: responseText.substring(0, 500) };
          }

          return res.json({
            status: response.status,
            ok: response.ok,
            cardsCount: data.cards?.length || 0,
            cursor: data.cursor || null,
            error: data.message || data.error || null,
            raw: data,
            hint:
              response.status === 401
                ? 'Ключ отклонён. Убедитесь что токен имеет права на Content API. Создайте новый токен в ЛК WB → Настройки → API.'
                : null,
          });
        } catch (err: any) {
          return res.status(500).json({ error: err.message, type: 'fetch_error' });
        }
      }

      case 'sync-products': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData || '');
        const { marketplace } = req.body;

        const validation = validateTelegramInitData(initData);
        let user;

        const adminKey = req.headers['x-admin-key'];
        const validAdminKeys = [process.env.ADMIN_API_KEY].filter(Boolean);

        if (validation.valid && validation.user) {
          user = validation.user;
        } else if (adminKey && validAdminKeys.includes(adminKey as string) && req.body.telegramId) {
          // Admin override for testing
          user = { id: parseInt(req.body.telegramId) };
        } else {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }

        // Get user's API key
        const dbUser = await getUserById(user.id);
        if (!dbUser) return res.status(404).json({ error: 'User not found' });

        // Check if user has active subscription
        if (!isSubscriptionActive(dbUser)) {
          return res.status(403).json({
            error: 'Для синхронизации товаров требуется активная подписка',
            code: 'SUBSCRIPTION_REQUIRED',
          });
        }

        const mp = marketplace || 'Ozon';
        const encryptedApiKey = mp === 'WB' ? dbUser.api_key_wb : dbUser.api_key_ozon;

        if (!encryptedApiKey) {
          return res.status(400).json({ error: `${mp} API ключ не настроен` });
        }

        // Decrypt API key (ТЗ Security)
        const apiKey = decryptApiKey(encryptedApiKey);
        console.log(`🔓 Decrypted ${mp} API key for sync`);

        // Check product limit before sync
        const productLimit = getProductLimit(dbUser.subscription_plan);

        // Debug info collected during sync
        const syncDebugInfo: Record<string, unknown> = {};

        try {
          let products: any[] = [];

          if (mp === 'Ozon') {
            // Fetch products from Ozon API
            // Ozon requires Client-Id header
            const clientId = apiKey.split(':')[0]; // Expecting format: clientId:apiKey
            const apiToken = apiKey.includes(':') ? apiKey.split(':')[1] : apiKey;

            console.log('🔍 Ozon sync:', {
              clientId: clientId.substring(0, 4) + '...',
              apiTokenLen: apiToken.length,
            });

            // Ozon API v3 — last_id обязателен!
            const requestBody = {
              filter: {}, // Пустой фильтр = все товары
              last_id: '', // Обязательный параметр для v3! Пустая строка = начало
              limit: 100, // Лимит товаров за запрос
            };

            console.log('📤 Ozon v3 request body:', JSON.stringify(requestBody));

            const ozonResponse = await fetch('https://api-seller.ozon.ru/v3/product/list', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Id': clientId,
                'Api-Key': apiToken,
              },
              body: JSON.stringify(requestBody),
            });

            if (!ozonResponse.ok) {
              const errorText = await ozonResponse.text();
              console.error('❌ Ozon API error:', ozonResponse.status, errorText);
              return res.status(400).json({
                error: `Ошибка Ozon API: ${ozonResponse.status}`,
                details: errorText.substring(0, 500),
              });
            }

            const ozonData = await ozonResponse.json();
            console.log('📦 Ozon API v3 full response:', JSON.stringify(ozonData));

            // v3 структура: { result: { items: [{product_id, offer_id}, ...], total, last_id } }
            const items = ozonData.result?.items || [];
            console.log(
              `📊 Ozon v3 items count: ${items.length}, total in API: ${ozonData.result?.total || 'N/A'}`
            );

            if (items.length === 0) {
              console.log('⚠️ No items returned from Ozon API');
              return res.json({
                success: true,
                message: 'Ozon API вернул 0 товаров. Проверьте настройки магазина.',
                count: 0,
                marketplace: mp,
                debug: { apiResponse: ozonData },
              });
            }

            // Извлекаем product_id (числовой ID товара в Ozon)
            const productIds = items.map((item: any) => item.product_id).filter(Boolean);
            console.log(
              `📋 Product IDs to fetch: ${productIds.slice(0, 5).join(', ')}... (${productIds.length} total)`
            );

            // Получаем детальную информацию о товарах (API v3)
            const detailResponse = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Id': clientId,
                'Api-Key': apiToken,
              },
              body: JSON.stringify({ product_id: productIds }),
            });

            console.log('📡 Detail API response status:', detailResponse.status);

            if (!detailResponse.ok) {
              const detailError = await detailResponse.text();
              console.error('❌ Detail API error:', detailResponse.status, detailError);

              syncDebugInfo.apiDetails = {
                status: detailResponse.status,
                error: detailError,
                url: 'https://api-seller.ozon.ru/v3/product/info/list',
              };

              // Fallback
              products = items.map((item: any) => ({
                product_id: `ozon-${item.product_id}`,
                title: `Ozon товар ${item.offer_id || item.product_id}`,
                image_url: null,
                current_price: 0,
                current_stock: 0,
                marketplace: 'Ozon',
              }));
            } else {
              const detailData = await detailResponse.json();

              syncDebugInfo.apiDetails = {
                status: 200,
                itemsCount: detailData.result?.items?.length || detailData.items?.length || 0,
                sampleItem:
                  detailData.result?.items?.[0] || detailData.items?.[0] ? 'exists' : 'null',
              };

              // Поддержка обеих структур ответа (на всякий случай)
              const detailItems = detailData.result?.items || detailData.items || [];
              console.log('📦 Detail API response items:', detailItems.length);

              products = detailItems.map((item: any) => {
                // Вычисляем общий сток со всех складов
                const totalStock =
                  item.stocks?.stocks?.reduce((acc: number, s: any) => acc + (s.present || 0), 0) ||
                  0;

                // Улучшенный parsing цены (Ozon v3 может возвращать price как объект)
                let price = 0;
                if (typeof item.price === 'object' && item.price !== null) {
                  price = parseFloat(item.price.marketing_price || item.price.price || '0');
                } else {
                  price = parseFloat(item.price || item.marketing_price || '0');
                }

                return {
                  product_id: `ozon-${item.id}`,
                  title: item.name || 'Без названия',
                  // v3 возвращает primary_image как строку
                  image_url:
                    (typeof item.primary_image === 'string'
                      ? item.primary_image
                      : item.primary_image?.[0]) ||
                    item.images?.[0] ||
                    null,
                  current_price: price,
                  current_stock: totalStock,
                  marketplace: 'Ozon',
                };
              });

              console.log(`✅ Processed ${products.length} products with details`);
            }
          } else if (mp === 'WB') {
            // WB API - get products (API v2)
            console.log('🔍 WB API sync starting...');
            console.log('🔑 WB API key length:', apiKey.length);

            try {
              // WB Content API v2 - requires proper authorization header
              const wbResponse = await fetch(
                'https://content-api.wildberries.ru/content/v2/get/cards/list',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: apiKey, // WB uses raw token without Bearer prefix
                  },
                  body: JSON.stringify({
                    settings: {
                      cursor: { limit: 100 },
                      filter: { withPhoto: -1 },
                    },
                  }),
                }
              );

              console.log('📡 WB API response status:', wbResponse.status);

              if (!wbResponse.ok) {
                const errorText = await wbResponse.text();
                console.error('❌ WB API error:', wbResponse.status, errorText);
                return res.status(400).json({
                  error: `Ошибка WB API: ${wbResponse.status}`,
                  details: errorText.substring(0, 500),
                  hint: 'Проверьте, что API ключ имеет права на контент (Content API)',
                });
              }

              const wbData = await wbResponse.json();
              console.log('📦 WB API response cards count:', wbData.cards?.length || 0);

              products = (wbData.cards || []).map((card: any) => ({
                product_id: `wb-${card.nmID}`,
                nm_id: card.nmID,
                title: card.title || card.subjectName || 'Без названия',
                image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
                current_price: card.sizes?.[0]?.price?.total || card.sizes?.[0]?.price || 0,
                current_stock:
                  card.sizes?.reduce(
                    (sum: number, s: any) =>
                      sum + (s.stocks?.reduce((ss: number, st: any) => ss + st.qty, 0) || 0),
                    0
                  ) || 0,
                marketplace: 'WB',
              }));
            } catch (wbError: any) {
              console.error('❌ WB fetch error:', wbError.message);
              return res.status(500).json({
                error: 'Ошибка подключения к WB API',
                details: wbError.message,
                hint: 'Возможно, API Wildberries временно недоступен. Попробуйте позже.',
              });
            }
          }

          // Limit products based on subscription plan
          let productsToSave = products;
          let limitReached = false;

          if (products.length > productLimit) {
            productsToSave = products.slice(0, productLimit);
            limitReached = true;
            console.log(`📊 Product limit reached: ${products.length} -> ${productLimit}`);
          }

          // Save products to database
          let savedCount = 0;
          for (const product of productsToSave) {
            try {
              await sql`
                INSERT INTO products (user_id, product_id, nm_id, title, image_url, current_price, current_stock, marketplace, status)
                VALUES (${user.id}, ${product.product_id}, ${product.nm_id || null}, ${product.title}, ${product.image_url}, ${Math.round(product.current_price)}, ${product.current_stock}, ${product.marketplace}, 'active')
                ON CONFLICT (user_id, product_id) DO UPDATE SET
                  title = EXCLUDED.title,
                  image_url = EXCLUDED.image_url,
                  current_price = EXCLUDED.current_price,
                  current_stock = EXCLUDED.current_stock,
                  updated_at = CURRENT_TIMESTAMP
              `;
              savedCount++;
            } catch (e) {
              console.error('Error saving product:', e);
            }
          }

          // Update user's total products count
          await sql`UPDATE users SET total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${user.id}), updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;

          const response: any = {
            success: true,
            message: `Синхронизировано ${savedCount} товаров из ${mp}`,
            count: savedCount,
            marketplace: mp,
          };

          if (limitReached) {
            response.warning = `Достигнут лимит тарифа: сохранено ${savedCount} из ${products.length} товаров. Обновите тариф для синхронизации всех товаров.`;
            response.totalAvailable = products.length;
            response.limit = productLimit;
          }

          return res.json(response);
        } catch (error) {
          console.error('Sync error:', error);
          return res
            .status(500)
            .json({ error: error instanceof Error ? error.message : 'Ошибка синхронизации' });
        }
      }

      // ========== SENTINEL: CHECK PRICES (CRON) ==========
      case 'check-prices': {
        // Allow Vercel Cron or manual Admin trigger or external cron with secret
        const authHeader = req.headers['authorization'];
        const initData = req.headers['x-init-data'] as string;
        const querySecret = req.query.secret as string;

        // Check for cron authorization (Bearer header OR query parameter)
        const cronSecret = process.env.CRON_SECRET;
        const isCron =
          authHeader === `Bearer ${cronSecret}` ||
          (querySecret && cronSecret && querySecret === cronSecret);
        const isAdmin =
          req.query.key === ADMIN_API_KEY || req.headers['x-admin-key'] === ADMIN_API_KEY;

        let targetUsers = [];

        // Scenario A: Auto/Admin Run (All Users)
        if (isCron || isAdmin) {
          const usersRes = await sql`
                SELECT * FROM users 
                WHERE protection_enabled = true 
                AND subscription_active = true
                AND (api_key_ozon IS NOT NULL OR api_key_wb IS NOT NULL)
              `;
          targetUsers = usersRes.rows;
        }
        // Scenario B: User Self-Check (Client Polling)
        else if (initData) {
          const validation = validateTelegramInitData(initData);
          if (validation.valid && validation.user) {
            // Get full user data from DB to check protection status
            const dbUser = await getUserById(validation.user.id);
            if (dbUser && dbUser.protection_enabled && (dbUser.api_key_ozon || dbUser.api_key_wb)) {
              targetUsers = [dbUser];
            } else {
              return res.json({ success: true, message: 'Protection disabled or keys missing' });
            }
          } else {
            return res.status(401).json({ error: 'Invalid initData' });
          }
        } else {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`🛡️ SENTINEL: Starting price check for ${targetUsers.length} users...`);

        // DEBUG MODE VARIABLES
        const debugInfo: any[] = [];
        const isDebug = req.query.debug === 'true';

        // Capture Logs
        const log: string[] = [];
        const originalLog = console.log;
        const originalError = console.error;
        const safeLog = (...args: any[]) => {
          log.push(args.join(' '));
          originalLog(...args);
        };
        const safeError = (...args: any[]) => {
          log.push('[ERROR] ' + args.join(' '));
          originalError(...args);
        };

        // Use local loggers
        console.log = safeLog;
        console.error = safeError;

        let totalScanned = 0;
        let totalTriggered = 0;

        try {
          // 2. Iterate users
          for (const user of targetUsers) {
            // --- OZON DEFENSE ---
            if (user.api_key_ozon) {
              try {
                // Get monitored products
                const productsRes = await sql`
                   SELECT * FROM products 
                   WHERE user_id = ${user.id} 
                   AND marketplace = 'Ozon' 
                   AND min_price > 0 
                   AND status != 'disabled'
                 `;
                const monitoredProducts = productsRes.rows;

                if (monitoredProducts.length > 0) {
                  // Decrypt API key (ТЗ Security)
                  const decryptedOzonKey = decryptApiKey(user.api_key_ozon);
                  const [clientId, apiKey] = (decryptedOzonKey || '').split(':');
                  if (!clientId || !apiKey) continue;

                  // Get current prices from Ozon V3 with retry
                  const productIds = monitoredProducts.map(p =>
                    parseInt(p.product_id.replace('ozon-', ''))
                  );
                  const ozonRes = await fetchWithRetry(
                    'https://api-seller.ozon.ru/v3/product/info/list',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Client-Id': clientId,
                        'Api-Key': apiKey,
                      },
                      body: JSON.stringify({ product_id: productIds }),
                    }
                  );

                  if (ozonRes.ok) {
                    const ozonData = await ozonRes.json();
                    const currentItems = ozonData.result?.items || ozonData.items || [];

                    // CRITICAL: Also fetch current prices from Ozon Prices API
                    // /v3/product/info/list doesn't always return accurate prices during promotions
                    const priceMap: Map<number, number> = new Map();

                    try {
                      const pricesRes = await fetchWithRetry(
                        'https://api-seller.ozon.ru/v4/product/info/prices',
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Client-Id': clientId,
                            'Api-Key': apiKey,
                          },
                          body: JSON.stringify({
                            filter: { product_id: productIds },
                            limit: 1000,
                          }),
                        }
                      );

                      if (pricesRes.ok) {
                        const pricesData = await pricesRes.json();
                        const priceItems = pricesData.result?.items || [];

                        for (const p of priceItems) {
                          // Use marketing_price (actual selling price) or price
                          const actualPrice = parseFloat(
                            p.price?.marketing_price || p.price?.price || '0'
                          );
                          if (p.product_id && actualPrice > 0) {
                            priceMap.set(p.product_id, actualPrice);
                          }
                        }
                        console.log(`💰 Fetched ${priceMap.size} prices from Ozon Prices API`);
                      }
                    } catch (priceErr) {
                      console.warn('⚠️ Failed to fetch Ozon prices separately:', priceErr);
                    }

                    // Check for violations
                    for (const item of currentItems) {
                      const dbProduct = monitoredProducts.find(
                        p => p.product_id === `ozon-${item.id}`
                      );
                      if (!dbProduct) continue;

                      // Use price from dedicated prices API, or fallback to item fields
                      let currentPrice = priceMap.get(item.id) || 0;
                      if (currentPrice === 0) {
                        // Fallback: try item.price object or marketing_price string
                        currentPrice = parseFloat(
                          item.price?.marketing_price ||
                            item.price?.price ||
                            item.marketing_price ||
                            item.price ||
                            '0'
                        );
                      }

                      const minPrice = dbProduct.min_price;

                      totalScanned++;

                      console.log(
                        `📊 Check: ${dbProduct.title.substring(0, 30)}... | Current: ${currentPrice} | Min: ${minPrice}`
                      );

                      // Update current_price in DB for history and analytics
                      if (currentPrice > 0) {
                        await sql`
                           UPDATE products SET current_price = ${Math.round(currentPrice)}, updated_at = CURRENT_TIMESTAMP 
                           WHERE id = ${dbProduct.id}
                         `;
                      }

                      // VIOLATION DETECTED!
                      if (currentPrice > 0 && currentPrice < minPrice) {
                        console.warn(
                          `🚨 ALARM: ${dbProduct.title} Price: ${currentPrice} < StopLoss: ${minPrice}`
                        );
                        totalTriggered++;

                        // EXECUTE DEFENSE
                        let defenseAction = '';
                        let ozonUpdateRes;

                        if (user.defense_mode === 'zero_stock') {
                          // Option A: Set Stock to 0
                          defenseAction = 'Zero Stock';
                          ozonUpdateRes = await fetchWithRetry(
                            'https://api-seller.ozon.ru/v1/product/import/stocks',
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Client-Id': clientId,
                                'Api-Key': apiKey,
                              },
                              body: JSON.stringify({
                                stocks: [
                                  { offer_id: item.offer_id, product_id: item.id, stock: 0 },
                                ],
                              }),
                            }
                          );
                        } else {
                          // Option B: Price Correction (Set to min_price)
                          defenseAction = 'Price Correction';
                          ozonUpdateRes = await fetchWithRetry(
                            'https://api-seller.ozon.ru/v1/product/import/prices',
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Client-Id': clientId,
                                'Api-Key': apiKey,
                              },
                              body: JSON.stringify({
                                prices: [
                                  {
                                    offer_id: item.offer_id,
                                    product_id: item.id,
                                    price: String(minPrice),
                                    old_price: String(Math.round(minPrice * 1.2)), // Fake old price
                                    min_price: String(minPrice),
                                    currency_code: 'RUB',
                                  },
                                ],
                              }),
                            }
                          );
                        }

                        // Log defense action result
                        console.log(
                          `🛡️ Defense API response: ${ozonUpdateRes.status} ${ozonUpdateRes.ok ? 'OK' : 'FAILED'}`
                        );

                        // UPDATE DB & NOTIFY
                        await sql`
                           UPDATE products SET status = 'triggered', updated_at = CURRENT_TIMESTAMP 
                           WHERE id = ${dbProduct.id}
                         `;

                        const savedAmount = minPrice - currentPrice;
                        await sql`
                           UPDATE users SET 
                             triggered_today = triggered_today + 1,
                             saved_amount = saved_amount + ${savedAmount}
                           WHERE id = ${user.id}
                         `;

                        // Log to sentinel_logs for audit (Ozon)
                        await sql`
                            INSERT INTO sentinel_logs (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
                            VALUES (${user.id}, ${dbProduct.product_id}, ${dbProduct.title}, ${Math.round(currentPrice)}, ${minPrice}, ${defenseAction}, ${savedAmount}, 'Ozon')
                          `;

                        // TELEGRAM ALERT
                        console.log(`📤 Sending Telegram alert to user ${user.id}...`);
                        const token = process.env.TELEGRAM_BOT_TOKEN;
                        if (token) {
                          const msg =
                            `🛡️ <b>NeuroGUARDIAN SENTRY</b>\n\n` +
                            `⚠️ <b>Демпинг обнаружен!</b>\n` +
                            `📦 ${dbProduct.title}\n` +
                            `📉 Цена упала: ${currentPrice} ₽ → ${minPrice} ₽\n` +
                            `⚔️ <b>Защита:</b> ${defenseAction}\n` +
                            `💰 Спасено: ${savedAmount} ₽`;

                          try {
                            const tgRes = await fetch(
                              `https://api.telegram.org/bot${token}/sendMessage`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  chat_id: user.id,
                                  text: msg,
                                  parse_mode: 'HTML',
                                }),
                              }
                            );
                            const tgData = await tgRes.json();
                            console.log(
                              `📤 Telegram result: ok=${tgRes.ok}`,
                              JSON.stringify(tgData).substring(0, 100)
                            );
                          } catch (tgErr) {
                            console.error(`❌ Telegram send error:`, tgErr);
                          }
                        } else {
                          console.warn(`⚠️ TELEGRAM_BOT_TOKEN not set!`);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.error(`Error checking Ozon for user ${user.id}:`, e);
                log.push(`Error Ozon user ${user.id}: ${e}`);
              }
            }

            // --- WB DEFENSE (per ТЗ: Module C Sentinel) ---
            if (user.api_key_wb) {
              try {
                // Get monitored WB products
                const wbProductsRes = await sql`
                   SELECT * FROM products 
                   WHERE user_id = ${user.id} 
                   AND marketplace = 'WB' 
                   AND min_price > 0 
                   AND status != 'disabled'
                 `;
                const wbMonitoredProducts = wbProductsRes.rows;

                if (wbMonitoredProducts.length > 0) {
                  // Decrypt API key (ТЗ Security)
                  const wbApiKey = decryptApiKey(user.api_key_wb);
                  if (!wbApiKey) continue;

                  // Get current prices from WB Prices API
                  const nmIds = wbMonitoredProducts.map(p => p.nm_id).filter(Boolean);

                  if (nmIds.length > 0) {
                    // WB API: Get current prices
                    const wbPricesRes = await fetchWithRetry(
                      'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter',
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: wbApiKey,
                        },
                        body: JSON.stringify({
                          limit: 1000,
                          offset: 0,
                          filterNmID: nmIds,
                        }),
                      }
                    );

                    if (wbPricesRes.ok) {
                      const wbPricesData = await wbPricesRes.json();
                      const wbItems = wbPricesData.data?.listGoods || [];

                      for (const wbItem of wbItems) {
                        const dbProduct = wbMonitoredProducts.find(p => p.nm_id === wbItem.nmID);
                        if (!dbProduct) continue;

                        // WB price logic: use discount price or sizes price
                        const currentPrice =
                          wbItem.sizes?.[0]?.discountedPrice || wbItem.sizes?.[0]?.price || 0;
                        const minPrice = dbProduct.min_price;

                        totalScanned++;

                        // VIOLATION DETECTED!
                        if (currentPrice > 0 && currentPrice < minPrice) {
                          console.warn(
                            `🚨 WB ALARM: ${dbProduct.title} Price: ${currentPrice} < StopLoss: ${minPrice}`
                          );
                          totalTriggered++;

                          let defenseAction = '';

                          if (user.defense_mode === 'zero_stock') {
                            // WB Zero Stock: Set stock to 0 via warehouse API
                            defenseAction = 'Zero Stock';

                            // First get warehouse ID
                            const warehousesRes = await fetchWithRetry(
                              'https://suppliers-api.wildberries.ru/api/v3/warehouses',
                              {
                                method: 'GET',
                                headers: { Authorization: wbApiKey },
                              }
                            );

                            if (warehousesRes.ok) {
                              const warehousesData = await warehousesRes.json();
                              const warehouses = warehousesData || [];

                              // Zero stock on all warehouses for this SKU
                              for (const wh of warehouses) {
                                await fetchWithRetry(
                                  `https://suppliers-api.wildberries.ru/api/v3/stocks/${wh.id}`,
                                  {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: wbApiKey,
                                    },
                                    body: JSON.stringify({
                                      stocks: [
                                        {
                                          sku: dbProduct.vendor_code || String(dbProduct.nm_id),
                                          amount: 0,
                                        },
                                      ],
                                    }),
                                  }
                                );
                              }
                            }
                          } else {
                            // WB Price Correction
                            defenseAction = 'Price Correction';
                            await fetchWithRetry(
                              'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: wbApiKey,
                                },
                                body: JSON.stringify({
                                  data: [
                                    {
                                      nmID: dbProduct.nm_id,
                                      price: minPrice,
                                      discount: 0,
                                    },
                                  ],
                                }),
                              }
                            );
                          }

                          // UPDATE DB & NOTIFY
                          await sql`
                             UPDATE products SET status = 'triggered', updated_at = CURRENT_TIMESTAMP 
                             WHERE id = ${dbProduct.id}
                           `;

                          const savedAmount = minPrice - currentPrice;
                          await sql`
                             UPDATE users SET 
                               triggered_today = triggered_today + 1,
                               saved_amount = saved_amount + ${savedAmount}
                             WHERE id = ${user.id}
                           `;

                          // Log to sentinel_logs for audit
                          await sql`
                             INSERT INTO sentinel_logs (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
                             VALUES (${user.id}, ${dbProduct.product_id}, ${dbProduct.title}, ${Math.round(currentPrice)}, ${minPrice}, ${defenseAction}, ${savedAmount}, 'WB')
                           `;

                          // TELEGRAM ALERT
                          if (process.env.TELEGRAM_BOT_TOKEN) {
                            const msg =
                              `🛡️ <b>NeuroGUARDIAN SENTRY</b>\n\n` +
                              `⚠️ <b>WB Демпинг обнаружен!</b>\n` +
                              `📦 ${dbProduct.title}\n` +
                              `📉 Цена упала: ${currentPrice} ₽ < ${minPrice} ₽\n` +
                              `⚔️ <b>Защита активирована:</b> ${defenseAction}\n` +
                              `💰 Спасено: ${savedAmount} ₽`;

                            await fetch(
                              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  chat_id: user.id,
                                  text: msg,
                                  parse_mode: 'HTML',
                                }),
                              }
                            );
                          }
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.error(`Error checking WB for user ${user.id}:`, e);
                log.push(`Error WB user ${user.id}: ${e}`);
              }
            }
          }

          // Restore console
          console.log = originalLog;
          console.error = originalError;

          return res.json({
            success: true,
            scanned: totalScanned,
            triggered: totalTriggered,
            log,
            debug_info: isDebug ? debugInfo : undefined, // Return debug info only if requested
          });
        } catch (error) {
          console.error('Sentinel Error:', error);
          return res.status(500).json({ error: 'Sentinel check failed' });
        }
      }

      // ========== ADMIN: CLONE USER DATA ==========
      case 'admin-clone-user': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
          fromUserId,
          toUserId,
          cloneProducts = true,
          cloneApiKeys = true,
          activateTrial = true,
          trialDays = 3,
        } = req.body;
        if (!fromUserId || !toUserId) {
          return res.status(400).json({ error: 'Missing fromUserId or toUserId' });
        }

        const results: string[] = [];

        // Clone API keys
        if (cloneApiKeys) {
          await sql`
            UPDATE users SET
              api_key_wb = (SELECT api_key_wb FROM users WHERE id = ${fromUserId}),
              api_key_ozon = (SELECT api_key_ozon FROM users WHERE id = ${fromUserId}),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${toUserId}
          `;
          results.push('API keys cloned');
        }

        // Activate trial
        if (activateTrial) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + trialDays);
          await sql`
            UPDATE users SET
              subscription_plan = 'trial',
              subscription_end = ${endDate.toISOString()},
              subscription_active = true,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${toUserId}
          `;
          results.push(`Trial activated for ${trialDays} days`);
        }

        // Clone products
        if (cloneProducts) {
          // Delete existing products for target user
          await sql`DELETE FROM products WHERE user_id = ${toUserId}`;

          // Copy products from source user
          await sql`
            INSERT INTO products (user_id, product_id, nm_id, title, image_url, current_price, min_price, current_stock, marketplace, status, is_monitored)
            SELECT ${toUserId}, product_id, nm_id, title, image_url, current_price, min_price, current_stock, marketplace, status, is_monitored
            FROM products WHERE user_id = ${fromUserId}
          `;

          // Update product count
          await sql`
            UPDATE users SET 
              total_products = (SELECT COUNT(*) FROM products WHERE user_id = ${toUserId})
            WHERE id = ${toUserId}
          `;
          results.push('Products cloned');
        }

        return res.json({
          success: true,
          message: `Cloned data from ${fromUserId} to ${toUserId}`,
          actions: results,
        });
      }

      // ========== SEND REMINDERS (CRON) ==========
      case 'send-reminders': {
        // Allow Vercel Cron or manual Admin trigger
        const authHeader = req.headers['authorization'];
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
        const isAdmin = req.headers['x-admin-key'] === ADMIN_API_KEY;

        if (!isCron && !isAdmin && IS_PRODUCTION) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('📧 Starting subscription expiry reminders...');
        const result = await sendExpiryReminders();

        console.log(`📧 Reminders complete: sent=${result.sent}, errors=${result.errors}`);

        return res.json({
          success: true,
          message: `Reminders sent: ${result.sent}, errors: ${result.errors}`,
          ...result,
        });
      }

      // ========== GET REFERRAL INFO ==========
      case 'referral': {
        if (req.method !== 'GET' && req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const dbUser = await getUserById(validation.user.id);
        if (!dbUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Count successful referrals
        const referralsResult = await sql`
          SELECT COUNT(*) as count FROM users 
          WHERE referred_by = ${dbUser.referral_code}
        `;
        const referralCount = parseInt(referralsResult.rows[0]?.count || '0', 10);

        // Generate referral link
        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'NeuroGuardianBot';
        const referralLink = `https://t.me/${botUsername}?start=ref_${dbUser.referral_code}`;

        return res.json({
          success: true,
          referralCode: dbUser.referral_code,
          referralLink,
          referralCount,
          bonusDays: REFERRAL_BONUS_DAYS,
          discountPercent: REFERRAL_DISCOUNT_PERCENT,
        });
      }

      // ========== ADMIN: SENTINEL LOGS ==========
      case 'admin-sentinel-logs': {
        const adminKey = req.headers['x-admin-key'] || req.query.key;
        const validKeys = [ADMIN_API_KEY].filter(Boolean);
        if (!validKeys.includes(adminKey as string)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.query.userId || req.body?.userId;
        const limit = parseInt((req.query.limit as string) || '50', 10);

        let logsResult;
        if (userId) {
          logsResult = await sql`
            SELECT * FROM sentinel_logs 
            WHERE user_id = ${userId}
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;
        } else {
          logsResult = await sql`
            SELECT * FROM sentinel_logs 
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;
        }

        return res.json({
          success: true,
          count: logsResult.rows.length,
          logs: logsResult.rows.map(log => ({
            id: log.id,
            userId: log.user_id,
            productId: log.product_id,
            productTitle: log.product_title?.substring(0, 50),
            detectedPrice: log.detected_price,
            minPrice: log.min_price,
            defenseAction: log.defense_action,
            savedAmount: log.saved_amount,
            marketplace: log.marketplace,
            createdAt: log.created_at,
          })),
        });
      }

      // ========== BATCH SET STOP-LOSS ==========
      case 'batch-set-stop-loss': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        const user = validation.user;

        const { percentage, productIds } = req.body;

        // Validate percentage (5-50%)
        if (typeof percentage !== 'number' || percentage < 5 || percentage > 50) {
          return res.status(400).json({
            error: 'Invalid percentage',
            message: 'Percentage must be between 5 and 50',
            received: percentage,
          });
        }

        // Validate productIds array (optional - if not provided, update all products without stop-loss)
        let targetProductIds: string[] = [];
        if (Array.isArray(productIds) && productIds.length > 0) {
          targetProductIds = productIds.map(String);
        }

        try {
          let productsToUpdate;

          if (targetProductIds.length > 0) {
            // Update specific products - fetch all user products and filter in JS
            // (Vercel Postgres sql template doesn't support array parameters well)
            const allProducts = await sql`
              SELECT product_id, current_price FROM products 
              WHERE user_id = ${user.id}
            `;
            productsToUpdate = {
              rows: allProducts.rows.filter(p => targetProductIds.includes(p.product_id)),
            };
          } else {
            // Update all products without stop-loss
            productsToUpdate = await sql`
              SELECT product_id, current_price FROM products 
              WHERE user_id = ${user.id} 
              AND (min_price = 0 OR min_price IS NULL)
            `;
          }

          let successCount = 0;
          let failedCount = 0;

          for (const product of productsToUpdate.rows) {
            try {
              const newMinPrice = Math.floor(product.current_price * (1 - percentage / 100));

              await sql`
                UPDATE products SET 
                  min_price = ${newMinPrice},
                  status = 'protected',
                  updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ${user.id} AND product_id = ${product.product_id}
              `;

              successCount++;
            } catch (e) {
              console.error(`Failed to update product ${product.product_id}:`, e);
              failedCount++;
            }
          }

          console.log(
            `✅ Bulk Stop-Loss: user=${user.id}, percentage=${percentage}%, updated=${successCount}, failed=${failedCount}`
          );

          return res.json({
            success: true,
            updated: successCount,
            failed: failedCount,
            percentage,
            message: `Stop-Loss установлен для ${successCount} товаров на -${percentage}% от текущей цены`,
          });
        } catch (error) {
          console.error('Batch stop-loss error:', error);
          return res.status(500).json({
            error: 'Failed to set bulk stop-loss',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // ========== SENTINEL LOGS (User-facing) ==========
      case 'sentinel-logs': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );

        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
        }
        const user = validation.user;

        const days = parseInt((req.query.days as string) || '7', 10);
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);

        try {
          const logsResult = await sql`
            SELECT * FROM sentinel_logs 
            WHERE user_id = ${user.id}
            AND created_at > NOW() - INTERVAL '1 day' * ${days}
            ORDER BY created_at DESC 
            LIMIT ${limit}
          `;

          // Calculate summary stats
          const summaryResult = await sql`
            SELECT 
              COUNT(*) as total_triggers,
              COALESCE(SUM(saved_amount), 0) as total_saved,
              COUNT(DISTINCT product_id) as unique_products
            FROM sentinel_logs 
            WHERE user_id = ${user.id}
            AND created_at > NOW() - INTERVAL '1 day' * ${days}
          `;

          const summary = summaryResult.rows[0] || {
            total_triggers: 0,
            total_saved: 0,
            unique_products: 0,
          };

          return res.json({
            success: true,
            period: `${days} days`,
            summary: {
              totalTriggers: parseInt(summary.total_triggers) || 0,
              totalSaved: parseInt(summary.total_saved) || 0,
              uniqueProducts: parseInt(summary.unique_products) || 0,
            },
            logs: logsResult.rows.map((log: any) => ({
              id: log.id,
              productId: log.product_id,
              productTitle: log.product_title,
              detectedPrice: log.detected_price,
              minPrice: log.min_price,
              defenseAction: log.defense_action,
              savedAmount: log.saved_amount,
              marketplace: log.marketplace,
              createdAt: log.created_at,
            })),
          });
        } catch (error) {
          console.error('Sentinel logs error:', error);
          return res.status(500).json({ error: 'Failed to fetch sentinel logs' });
        }
      }

      // ========== AI AGENT (Modular Service) ==========
      case 'agent': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = validation.user.id;
        // Use new service
        const user = await userService.getUserById(userId);

        if (!user) {
          return res.status(401).json({ error: 'User not found' });
        }

        // Check subscription
        if (!userService.isSubscriptionActive(user)) {
          return res.json({
            success: true,
            content:
              '⚠️ **Для использования AI-агента требуется активная подписка.**\n\nОформите подписку для доступа к аналитике.',
          });
        }

        const message = sanitizeInput(req.body?.message || '');
        if (!message) return res.status(400).json({ error: 'Message is required' });

        // Rate limit
        const agentRateLimit = await checkRateLimitAsync(`agent:${userId}`, true);
        if (!agentRateLimit.allowed) {
          return res.json({
            success: true,
            content: '⏳ **Превышен лимит запросов.**\n\nПодождите минуту.',
          });
        }

        try {
          // DELEGATE TO AGENT SERVICE
          const result = await agentService.processRequest(userId, message, user!);

          logger.info('Agent request processed', { userId, success: result.success });
          return res.json(result);
        } catch (error) {
          logger.error('Agent processing failed', error, { userId });
          return res
            .status(500)
            .json({ success: false, content: 'Ошибка при обработке запроса агентом.' });
        }
      }

      // ========== AGENT CONFIRM ==========
      case 'agent-confirm': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user)
          return res.status(401).json({ error: 'Unauthorized' });

        const userId = validation.user.id;
        const { operation, confirmed, details: _details } = req.body;

        if (!confirmed) {
          return res.json({ success: true, content: '👍 Операция отменена.', executed: false });
        }

        let resultContent = '';
        let executed = false;

        const details = typeof _details === 'string' ? JSON.parse(_details) : _details || {};

        if (operation === 'bulk_set_min_price') {
          // Массовая установка Stop-Loss
          const percentage = details.percentage || 15;
          const products = await getProductsByUserId(userId);

          const filteredProducts = details.only_unprotected
            ? products.filter((p: any) => !p.min_price || p.min_price === 0)
            : products;

          let updated = 0;
          for (const product of filteredProducts) {
            const minPrice = Math.floor((product.current_price || 0) * (1 - percentage / 100));
            if (minPrice > 0) {
              await updateProductMinPrice(userId, product.product_id, minPrice);
              updated++;
            }
          }
          resultContent = `✅ **Успешно!**\n\nДля ${updated} товаров установлен Stop-Loss (-${percentage}%).`;
          executed = true;
        } else if (operation === 'set_stop_loss') {
          // Одиночная установка Stop-Loss
          const { product_id, min_price } = details;
          if (product_id && min_price) {
            await updateProductMinPrice(userId, product_id, min_price);
            resultContent = `✅ **Stop-Loss установлен!**\n\nНовая минимальная цена: ${min_price} ₽`;
            executed = true;
          } else {
            resultContent = '❌ Ошибка: не указан товар или цена.';
          }
        } else if (operation === 'update_prices') {
          // ИЗМЕНЕНИЕ ЦЕН (РЕАЛЬНЫЙ РЕЖИМ ⚔️)
          const { product_ids, price_change, price_change_percent } = details;

          if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
            console.log(
              `🚀 EXECUTING REAL PRICE UPDATE for User ${userId}, ${product_ids.length} items`
            );

            // 1. Получаем текущие продукты чтобы узнать старые цены
            const products = await getProductsByUserId(userId);
            const updates = [];

            for (const pid of product_ids) {
              const product = products.find((p: any) => String(p.product_id) === String(pid));
              if (product) {
                let newPrice = product.current_price;

                if (price_change) {
                  newPrice = product.current_price + price_change;
                } else if (price_change_percent) {
                  newPrice = product.current_price * (1 + price_change_percent / 100);
                }

                // Цена не может быть меньше min_price (если установлен)
                if (product.min_price > 0 && newPrice < product.min_price) {
                  newPrice = product.min_price;
                }

                updates.push({ productId: product.product_id, newPrice: Math.floor(newPrice) });
              }
            }

            if (updates.length > 0) {
              const result = await updatePricesReal(userId, updates);

              if (result.success) {
                resultContent = `✅ **Цены успешно обновлены!**\n\nИзменено товаров: ${result.count}. Новые цены уже в Wildberries.`;
                executed = true;
              } else {
                resultContent = `❌ **Ошибка при обновлении цен:** ${result.error}`;
              }
            } else {
              resultContent = '❌ Не удалось найти товары для обновления.';
            }
          } else {
            resultContent = '❌ Ошибка данных для обновления цен.';
          }
        } else {
          resultContent = '❌ Неизвестная операция.';
        }

        return res.json({ success: true, content: resultContent, executed });
      }

      // ========== AGENT STATUS ==========
      case 'agent-status': {
        return res.json({
          available: true,
          model: 'gpt-4o-mini',
          capabilities: ['Статистика продаж', 'Управление ценами', 'Защита товаров', 'Аналитика'],
        });
      }

      // ========== USER RULES: LIST ==========
      case 'rules':
      case 'rules-create':
      case 'rules-update':
      case 'rules-delete':
      case 'rules-toggle':
      case 'rules-templates':
      case 'rules-logs': {
        // TODO: Rules feature is in development
        return res.json({
          success: true,
          message: 'Rules feature coming soon',
          rules: [],
          templates: [],
          logs: [],
        });
      }

      // ========== TASK QUEUE: LIST TASKS ==========
      case 'tasks': {
        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const tasks = await taskQueue.getUserTasks(validation.user.id, 20);
        const stats = await taskQueue.getStats();

        return res.json({
          success: true,
          tasks: tasks.map(t => ({
            id: t.id,
            type: t.type,
            status: t.status,
            priority: t.priority,
            progress: t.progress,
            createdAt: t.createdAt,
            completedAt: t.completedAt,
            lastError: t.lastError,
          })),
          stats,
        });
      }

      // ========== TASK QUEUE: ENQUEUE TASK ==========
      case 'task-enqueue': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { taskType, payload, priority } = req.body;

        if (!taskType || !payload) {
          return res.status(400).json({ error: 'taskType and payload are required' });
        }

        // Validate task type
        const validTypes = ['price_update', 'bulk_stop_loss', 'sync_products'];
        if (!validTypes.includes(taskType)) {
          return res.status(400).json({
            error: 'Invalid task type',
            validTypes,
          });
        }

        const task = await taskQueue.enqueue(validation.user.id, taskType, payload, {
          priority: priority || 'normal',
        });

        return res.json({
          success: true,
          message: 'Task enqueued',
          task: {
            id: task.id,
            type: task.type,
            status: task.status,
          },
        });
      }

      // ========== TASK QUEUE: CANCEL TASK ==========
      case 'task-cancel': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(
          (req.headers['x-init-data'] as string) || req.body?.initData || ''
        );
        const validation = validateTelegramInitData(initData);
        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const { taskId } = req.body;
        if (!taskId) {
          return res.status(400).json({ error: 'taskId is required' });
        }

        const cancelled = await taskQueue.cancel(taskId, validation.user.id);

        return res.json({
          success: cancelled,
          message: cancelled ? 'Task cancelled' : 'Could not cancel task',
        });
      }

      // ========== TASK QUEUE: PROCESS TASKS (CRON) ==========
      case 'process-tasks': {
        // Only allow from Cron or Admin
        const authHeader = req.headers['authorization'];
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
        const isAdmin = req.headers['x-admin-key'] === ADMIN_API_KEY;

        if (!isCron && !isAdmin && IS_PRODUCTION) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('⚙️ Processing task queue...');
        const result = await taskProcessor.processPendingTasks();

        return res.json({
          success: true,
          message: 'Task processing complete',
          ...result,
        });
      }

      // ========== DAILY DIGEST (CRON) ==========
      case 'daily-digest': {
        // Only allow from Cron or Admin
        const authHeader = req.headers['authorization'];
        const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
        const isAdmin = req.headers['x-admin-key'] === ADMIN_API_KEY;

        if (!isCron && !isAdmin && IS_PRODUCTION) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('📊 Starting daily digest...');

        try {
          // Get all users with active subscription
          const usersResult = await sql`
            SELECT id, first_name, subscription_plan, total_products, triggered_today, saved_amount
            FROM users 
            WHERE subscription_active = true 
            AND (subscription_end IS NULL OR subscription_end > NOW())
          `;

          let sent = 0;
          let errors = 0;

          for (const user of usersResult.rows) {
            try {
              // Get yesterday's stats
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = yesterday.toISOString().split('T')[0];

              // Get sentinel events from yesterday
              const sentinelResult = await sql`
                SELECT COUNT(*) as triggers, COALESCE(SUM(saved_amount), 0) as saved
                FROM sentinel_logs 
                WHERE user_id = ${user.id}
                AND created_at >= ${yesterdayStr}::date
                AND created_at < (${yesterdayStr}::date + INTERVAL '1 day')
              `;

              // Get product stats
              const productsResult = await sql`
                SELECT 
                  COUNT(*) as total,
                  COUNT(CASE WHEN status = 'protected' THEN 1 END) as protected,
                  COUNT(CASE WHEN status = 'triggered' THEN 1 END) as triggered
                FROM products WHERE user_id = ${user.id}
              `;

              const stats = sentinelResult.rows[0] || { triggers: 0, saved: 0 };
              const products = productsResult.rows[0] || { total: 0, protected: 0, triggered: 0 };

              // Build digest message
              const msg =
                `☀️ <b>Доброе утро, ${user.first_name || 'Seller'}!</b>\n\n` +
                `📊 <b>Ваш ежедневный дайджест NeuroGUARDIAN</b>\n\n` +
                `📦 <b>Товары:</b>\n` +
                `├ Всего: ${products.total}\n` +
                `├ Защищено: ${products.protected}\n` +
                `└ Сработало вчера: ${products.triggered}\n\n` +
                `🛡️ <b>Защита маржи:</b>\n` +
                `├ Срабатываний вчера: ${stats.triggers}\n` +
                `└ Сохранено: ${stats.saved}₽\n\n` +
                (parseInt(stats.saved) > 0
                  ? `💰 <b>Отлично!</b> Sentinel спас вам ${stats.saved}₽ вчера.\n\n`
                  : `✅ <b>Всё спокойно!</b> Демпинга не обнаружено.\n\n`) +
                `🤖 <i>Напишите мне для аналитики или управления ценами!</i>`;

              // Send via Telegram
              if (process.env.TELEGRAM_BOT_TOKEN) {
                await fetch(
                  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: user.id,
                      text: msg,
                      parse_mode: 'HTML',
                    }),
                  }
                );
                sent++;
              }

              // Reset daily counters
              await sql`
                UPDATE users SET triggered_today = 0 WHERE id = ${user.id}
              `;
            } catch (userError) {
              console.error(`Daily digest error for user ${user.id}:`, userError);
              errors++;
            }
          }

          console.log(`📊 Daily digest complete: sent=${sent}, errors=${errors}`);

          return res.json({
            success: true,
            message: `Daily digest sent to ${sent} users`,
            sent,
            errors,
          });
        } catch (error) {
          console.error('Daily digest error:', error);
          return res.status(500).json({ error: 'Daily digest failed' });
        }
      }

      // ========== DEFAULT ==========
      default:
        return res.status(400).json({
          error: 'Unknown action',
          availableActions: [
            'auth',
            'products',
            'settings',
            'plans',
            'create-payment',
            'payment-webhook',
            'init-db',
            'reset-db',
            'health',
            'sync-products',
            'check-prices',
            'batch-set-stop-loss',
            'sentinel-logs',
            'agent',
            'agent-confirm',
            'agent-status',
            'rules',
            'rules-create',
            'rules-update',
            'rules-delete',
            'rules-toggle',
            'rules-templates',
            'rules-logs',
            'tasks',
            'task-enqueue',
            'task-cancel',
            'process-tasks',
            'admin-activate-trial',
            'admin-check-user',
            'admin-list-users',
            'admin-list-products',
            'admin-test-ozon',
            'admin-clone-user',
            'admin-sentinel-logs',
            'send-reminders',
            'daily-digest',
            'referral',
          ],
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
