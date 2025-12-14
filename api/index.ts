// ============================================
// NeuroGUARDIAN — Unified API Handler
// All endpoints in one file (Vercel Hobby limit: 12 functions)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// CONFIGURATION
// ============================================

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
// TELEGRAM AUTH (simplified for MVP)
// ============================================

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
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

// Demo user for testing
const DEMO_USER: TelegramUser = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
};

function getUser(initData: string): TelegramUser | null {
  // Try to parse user from initData (simple parsing, no crypto validation for MVP)
  if (initData && initData !== 'demo' && initData !== '') {
    const user = parseInitDataUnsafe(initData);
    if (user) {
      console.log('✅ User from initData:', user.id);
      return user;
    }
  }
  
  // Fallback: demo user for testing
  console.log('🧪 Using demo user for testing');
  return DEMO_USER;
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
  
  // Check if user exists
  const existingUser = await sql`SELECT id FROM users WHERE id = ${user.id}`;
  const isNewUser = existingUser.rows.length === 0;
  
  // Calculate trial end date (30 days from now)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);
  
  if (isNewUser) {
    // Create new user with trial subscription
    const result = await sql`
      INSERT INTO users (id, username, first_name, last_name, photo_url, referral_code, subscription_plan, subscription_end, subscription_active)
      VALUES (${user.id}, ${user.username || null}, ${user.first_name}, ${user.last_name || null}, ${user.photo_url || null}, ${referralCode}, 'trial', ${trialEndDate.toISOString()}, true)
      RETURNING *
    `;
    console.log(`✅ New user created with trial: ${user.id}`);
    return result.rows[0];
  } else {
    // Update existing user
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
        
        // getUser handles empty initData by returning demo user
        const telegramUser = getUser(initData || '');
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
        const initData = req.headers['x-init-data'] as string || req.body?.initData || '';

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

        const user = getUser(initData || '');
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (marketplace && apiKey) {
          if (marketplace === 'WB') {
            await sql`UPDATE users SET api_key_wb = ${apiKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
          } else {
            await sql`UPDATE users SET api_key_ozon = ${apiKey}, updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}`;
          }
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

        const user = getUser(initData || '');
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        if (!planId || !SUBSCRIPTION_PLANS[planId as PlanId]) {
          return res.status(400).json({ error: 'Invalid plan' });
        }

        const plan = SUBSCRIPTION_PLANS[planId as PlanId];

        // TEST MODE: If YooKassa is not configured, activate subscription immediately
        if (!SHOP_ID || !SECRET_KEY) {
          console.log('🧪 TEST MODE: Activating subscription without payment');
          
          await activateSubscription(user.id, planId === 'yearly' ? 'pro' : planId, plan.durationDays);
          
          return res.json({
            success: true,
            testMode: true,
            message: `Тестовый режим: подписка ${plan.name} активирована на ${plan.durationDays} дней`,
            plan: { id: planId, name: plan.name, price: plan.price, durationDays: plan.durationDays },
          });
        }

        // Production: Create real YooKassa payment
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
          hasYookassaShopId: !!SHOP_ID,
        });
      }

      // ========== ADMIN: ACTIVATE TRIAL ==========
      case 'admin-activate-trial': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;
        if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
          return res.status(401).json({ error: 'Unauthorized' });
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

      // ========== SYNC PRODUCTS ==========
      case 'sync-products': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const { initData, marketplace } = req.body;

        const user = getUser(initData || '');
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Get user's API key
        const dbUser = await getUserById(user.id);
        if (!dbUser) return res.status(404).json({ error: 'User not found' });

        const mp = marketplace || 'Ozon';
        const apiKey = mp === 'WB' ? dbUser.api_key_wb : dbUser.api_key_ozon;

        console.log('🔑 Debug key info:', { 
          mp, 
          keyExists: !!apiKey, 
          keyLen: apiKey?.length,
          hasColon: apiKey?.includes(':'),
          keyPreview: apiKey?.substring(0, 10) + '...'
        });

        if (!apiKey) {
          return res.status(400).json({ error: `${mp} API ключ не настроен` });
        }

        try {
          let products: any[] = [];

          if (mp === 'Ozon') {
            // Fetch products from Ozon API
            // Ozon requires Client-Id header
            const clientId = apiKey.split(':')[0]; // Expecting format: clientId:apiKey
            const apiToken = apiKey.includes(':') ? apiKey.split(':')[1] : apiKey;

            console.log('🔍 Ozon sync:', { clientId: clientId.substring(0, 4) + '...', apiTokenLen: apiToken.length });

            const ozonResponse = await fetch('https://api-seller.ozon.ru/v3/product/list', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Id': clientId,
                'Api-Key': apiToken,
              },
              body: JSON.stringify({
                filter: { visibility: 'ALL' },
                limit: 100,
              }),
            });

            if (!ozonResponse.ok) {
              const errorText = await ozonResponse.text();
              console.error('Ozon API error:', ozonResponse.status, errorText);
              return res.status(400).json({ 
                error: `Ошибка Ozon API: ${ozonResponse.status}`,
                details: errorText.substring(0, 200),
              });
            }

            const ozonData = await ozonResponse.json();
            const productIds = ozonData.result?.items?.map((item: any) => item.product_id) || [];

            if (productIds.length > 0) {
              // Get detailed product info
              const detailResponse = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Id': clientId,
                  'Api-Key': apiToken,
                },
                body: JSON.stringify({ product_id: productIds }),
              });

              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                products = (detailData.result?.items || []).map((item: any) => ({
                  product_id: `ozon-${item.id}`,
                  title: item.name || 'Без названия',
                  image_url: item.primary_image || item.images?.[0] || null,
                  current_price: Math.round((item.price || item.marketing_price || 0) * 100) / 100,
                  current_stock: item.stocks?.present || 0,
                  marketplace: 'Ozon',
                }));
              }
            }
          } else if (mp === 'WB') {
            // WB API - get products
            const wbResponse = await fetch('https://suppliers-api.wildberries.ru/content/v2/get/cards/list', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
              },
              body: JSON.stringify({
                settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } },
              }),
            });

            if (!wbResponse.ok) {
              return res.status(400).json({ error: 'Ошибка WB API: ' + wbResponse.status });
            }

            const wbData = await wbResponse.json();
            products = (wbData.cards || []).map((card: any) => ({
              product_id: `wb-${card.nmID}`,
              nm_id: card.nmID,
              title: card.title || card.subjectName || 'Без названия',
              image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
              current_price: card.sizes?.[0]?.price || 0,
              current_stock: card.sizes?.reduce((sum: number, s: any) => sum + (s.stocks?.reduce((ss: number, st: any) => ss + st.qty, 0) || 0), 0) || 0,
              marketplace: 'WB',
            }));
          }

          // Save products to database
          let savedCount = 0;
          for (const product of products) {
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

          return res.json({
            success: true,
            message: `Синхронизировано ${savedCount} товаров из ${mp}`,
            count: savedCount,
            marketplace: mp,
          });
        } catch (error) {
          console.error('Sync error:', error);
          return res.status(500).json({ error: error instanceof Error ? error.message : 'Ошибка синхронизации' });
        }
      }

      // ========== DEFAULT ==========
      default:
        return res.status(400).json({ 
          error: 'Unknown action',
          availableActions: ['auth', 'products', 'settings', 'plans', 'create-payment', 'payment-webhook', 'init-db', 'health', 'sync-products'],
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
}
