// ============================================
// NeuroGUARDIAN — Unified API Handler
// All endpoints in one file (Vercel Hobby limit: 12 functions)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SHOP_ID = process.env.YOOKASSA_SHOP_ID || '';
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY || '';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

// ============================================
// SUBSCRIPTION PLANS
// ============================================

const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Базовый',
    price: 499,
    durationDays: 30,
    maxProducts: 50,
    features: ['До 50 товаров', 'Защита Zero Stock', 'Telegram уведомления'],
  },
  pro: {
    id: 'pro',
    name: 'Профессиональный',
    price: 999,
    durationDays: 30,
    maxProducts: 500,
    features: ['До 500 товаров', 'Оба режима защиты', 'Приоритетная поддержка', 'API доступ'],
  },
  yearly: {
    id: 'yearly',
    name: 'Годовой Pro',
    price: 9990,
    durationDays: 365,
    maxProducts: 500,
    features: ['Все из Pro', 'Экономия 2000₽', 'Персональный менеджер'],
  },
} as const;

type PlanId = keyof typeof SUBSCRIPTION_PLANS;

// ============================================
// TELEGRAM AUTH
// ============================================

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

function validateInitData(initData: string): TelegramUser | null {
  if (!initData || !BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Date.now() / 1000 - authDate > 86400) return null;

    const userJson = params.get('user');
    if (!userJson) return null;

    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}

function parseInitDataUnsafe(initData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) return null;
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}

function getUser(initData: string): TelegramUser | null {
  const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
  return isDev ? parseInitDataUnsafe(initData) : validateInitData(initData);
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

  await sql`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
}

async function createOrUpdateUser(user: TelegramUser) {
  const referralCode = `NG${user.id.toString(36).toUpperCase()}`;
  
  const result = await sql`
    INSERT INTO users (id, username, first_name, last_name, photo_url, referral_code)
    VALUES (${user.id}, ${user.username || null}, ${user.first_name}, ${user.last_name || null}, ${user.photo_url || null}, ${referralCode})
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      photo_url = EXCLUDED.photo_url,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  return result.rows[0];
}

async function getUserById(userId: number) {
  const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
  return result.rows[0];
}

async function getProductsByUserId(userId: number) {
  const result = await sql`SELECT * FROM products WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return result.rows;
}

async function updateProductMinPrice(userId: number, productId: string, minPrice: number) {
  await sql`
    UPDATE products SET 
      min_price = ${minPrice},
      status = CASE WHEN ${minPrice} > 0 THEN 'protected' ELSE 'active' END,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND product_id = ${productId}
  `;
}

async function activateSubscription(userId: number, plan: string, durationDays: number, paymentMethodId?: string) {
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

async function createYookassaPayment(userId: number, planId: PlanId, returnUrl: string) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) return { success: false, error: 'Invalid plan' };

  const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');
  const idempotencyKey = uuidv4();
  const transactionId = uuidv4();

  const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Idempotence-Key': idempotencyKey,
    },
    body: JSON.stringify({
      amount: { value: plan.price.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'embedded', return_url: returnUrl },
      capture: true,
      description: `NeuroGUARDIAN: ${plan.name} подписка`,
      metadata: { user_id: userId.toString(), plan_id: planId, transaction_id: transactionId },
      save_payment_method: true,
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
// CORS HEADERS
// ============================================

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Init-Data, X-Admin-Key');
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Parse action from query or body
  const action = req.query.action as string || req.body?.action;

  try {
    switch (action) {
      // ========== AUTH ==========
      case 'auth': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        
        const { initData } = req.body;
        if (!initData) return res.status(400).json({ error: 'Missing initData' });

        const telegramUser = getUser(initData);
        if (!telegramUser) return res.status(401).json({ error: 'Invalid initData' });

        const user = await createOrUpdateUser(telegramUser);
        const fullUser = await getUserById(telegramUser.id);

        let subscriptionActive = false;
        let daysLeft = null;
        if (fullUser?.subscription_end) {
          const endDate = new Date(fullUser.subscription_end);
          subscriptionActive = endDate > new Date();
          daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
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
        const initData = req.headers['x-init-data'] as string || req.body?.initData;
        if (!initData) return res.status(401).json({ error: 'Missing initData' });

        const user = getUser(initData);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

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
          const { productId, minPrice } = req.body;
          if (!productId || typeof minPrice !== 'number') {
            return res.status(400).json({ error: 'Invalid parameters' });
          }
          await updateProductMinPrice(user.id, productId, minPrice);
          return res.json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
      }

      // ========== SETTINGS ==========
      case 'settings': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { initData, protectionEnabled, defenseMode, marketplace, apiKey } = req.body;
        if (!initData) return res.status(401).json({ error: 'Missing initData' });

        const user = getUser(initData);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (marketplace && apiKey) {
          const field = marketplace === 'WB' ? 'api_key_wb' : 'api_key_ozon';
          await sql`UPDATE users SET ${sql(field)} = ${apiKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
          return res.json({ success: true, message: `${marketplace} API ключ сохранён` });
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

        const plans = Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
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

        const { initData, planId } = req.body;
        if (!initData) return res.status(401).json({ error: 'Missing initData' });

        const user = getUser(initData);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (!planId || !SUBSCRIPTION_PLANS[planId as PlanId]) {
          return res.status(400).json({ error: 'Invalid plan' });
        }

        const returnUrl = process.env.WEBAPP_URL || `https://${process.env.VERCEL_URL}` || 'https://neuro-guardian.vercel.app';
        const result = await createYookassaPayment(user.id, planId as PlanId, `${returnUrl}?payment_complete=true`);

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        return res.json(result);
      }

      // ========== PAYMENT WEBHOOK ==========
      case 'payment-webhook': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const event = req.body;
        if (!event?.object?.id) return res.status(400).json({ error: 'Invalid payload' });

        const payment = event.object;
        const metadata = payment.metadata || {};
        const userId = parseInt(metadata.user_id, 10);
        const planId = metadata.plan_id as PlanId;

        if (payment.status === 'succeeded' && userId && planId) {
          const plan = SUBSCRIPTION_PLANS[planId];
          if (plan) {
            const actualPlan = planId === 'yearly' ? 'pro' : planId;
            await activateSubscription(userId, actualPlan, plan.durationDays, payment.payment_method?.id);

            // Update transaction
            await sql`
              UPDATE transactions SET status = 'succeeded', yookassa_payment_id = ${payment.id}, paid_at = CURRENT_TIMESTAMP
              WHERE user_id = ${userId} AND status = 'pending'
              ORDER BY created_at DESC LIMIT 1
            `;
          }
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

      // ========== HEALTH ==========
      case 'health': {
        let dbOk = false;
        try {
          await sql`SELECT 1`;
          dbOk = true;
        } catch {}

        return res.json({
          status: dbOk ? 'healthy' : 'unhealthy',
          version: '2.0.0',
          database: dbOk,
          hasPostgresUrl: !!process.env.POSTGRES_URL,
          hasTelegramToken: !!BOT_TOKEN,
          hasYookassaShopId: !!SHOP_ID,
        });
      }

      // ========== DEFAULT ==========
      default:
        return res.status(400).json({ 
          error: 'Unknown action',
          availableActions: ['auth', 'products', 'settings', 'plans', 'create-payment', 'payment-webhook', 'init-db', 'health'],
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
