// ============================================
// NeuroGUARDIAN — Unified API Handler v3.0
// Refactored: Modular structure with handlers
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { kv } from '@vercel/kv';
import * as crypto from 'crypto';

// ============================================
// IMPORTS FROM MODULAR LIBRARY
// ============================================

import {
  validateTelegramInitData,
  sanitizeInput,
  encryptApiKey,
  decryptApiKey,
  SUBSCRIPTION_PLANS,
  TEST_MODE,
  IS_PRODUCTION,
  ALLOWED_ORIGINS,
  OPENAI_API_KEY,
  type TelegramUser,
  type PlanId,
  type OpenAIMessage,
  type ToolCall,
} from '../src/api-lib/lib/index.js';

import {
  initializeDatabase,
  createOrUpdateUser,
  getUserById,
  getProductsByUserId,
  updateProductMinPrice,
  activateSubscription,
  createTransaction,
  updateTransactionStatus,
  logSentinelAction,
} from '../src/api-lib/services/index.js';

import {
  createYookassaPayment,
  getPaymentStatus,
  isValidYookassaIP,
} from '../src/api-lib/services/yookassa.js';

import {
  sendTelegramNotification,
  sendExpiryReminders,
  sendProtectionAlert,
} from '../src/api-lib/services/notifications.js';

import { AGENT_SYSTEM_PROMPT } from '../src/api-lib/agent/system-prompt.js';
import { AGENT_TOOLS, requiresConfirmation } from '../src/api-lib/agent/tools.js';

// ============================================
// LOCAL CONFIGURATION
// ============================================

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 1000;
const REFERRAL_BONUS_DAYS = 30;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============================================
// RATE LIMITING (KV-backed)
// ============================================

async function checkRateLimitAsync(
  identifier: string,
  limit: number = RATE_LIMIT
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const key = `rate:${identifier}`;
    const current = await kv.incr(key);

    if (current === 1) {
      await kv.expire(key, 60); // 1 minute expiry
    }

    const remaining = Math.max(0, limit - current);
    return { allowed: current <= limit, remaining };
  } catch {
    // Fallback if KV fails
    return { allowed: true, remaining: limit };
  }
}

// ============================================
// CORS SETUP
// ============================================

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin || '';

  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Init-Data, X-Admin-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Fetch failed');
}

function getDateFromPeriod(period: string): string {
  const now = new Date();
  const days: Record<string, number> = {
    today: 0,
    yesterday: 1,
    week: 7,
    month: 30,
    '3months': 90,
  };

  now.setDate(now.getDate() - (days[period] || 7));
  return now.toISOString().split('T')[0];
}

function isSubscriptionActive(user: Record<string, unknown>): boolean {
  if (TEST_MODE) return true;
  if (!user?.subscription_end) return false;
  return new Date(user.subscription_end as string) > new Date();
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCorsHeaders(req, res);
    return res.status(200).end();
  }

  setCorsHeaders(req, res);

  // Rate limiting
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    'unknown';
  const rateLimit = await checkRateLimitAsync(clientIp);

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // Parse action
  const action = sanitizeInput((req.query.action as string) || req.body?.action);

  console.log(`📥 API: ${method} action=${action}`);

  try {
    switch (action) {
      // ========== AUTH ==========
      case 'auth': {
        if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        const initData = sanitizeInput(req.body?.initData);
        const validation = validateTelegramInitData(initData);

        if (!validation.valid || !validation.user) {
          return res.status(401).json({ error: validation.error || 'Auth failed' });
        }

        const tgUser = validation.user;
        await createOrUpdateUser(tgUser);
        const dbUser = await getUserById(tgUser.id);

        let subscriptionActive = TEST_MODE || isSubscriptionActive(dbUser || {});
        const subscriptionPlan = TEST_MODE ? 'pro' : dbUser?.subscription_plan || 'trial';
        const subscriptionEnd = TEST_MODE
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : dbUser?.subscription_end;

        // Trial always active
        if (dbUser?.subscription_plan === 'trial') {
          subscriptionActive = true;
        }

        const productsResult =
          await sql`SELECT COUNT(*) as count FROM products WHERE user_id = ${tgUser.id}`;
        const totalProducts = Number(productsResult.rows[0]?.count || 0);

        return res.json({
          user: {
            id: tgUser.id,
            firstName: sanitizeInput(tgUser.first_name),
            lastName: tgUser.last_name ? sanitizeInput(tgUser.last_name) : undefined,
            username: tgUser.username ? sanitizeInput(tgUser.username) : undefined,
            photoUrl: tgUser.photo_url,
          },
          subscription: {
            active: subscriptionActive,
            plan: subscriptionPlan,
            expiresAt: subscriptionEnd,
          },
          settings: {
            defenseMode: dbUser?.defense_mode || 'zero_stock',
            protectionEnabled: dbUser?.protection_enabled || false,
            hasWbApiKey: !!dbUser?.api_key_wb,
            hasOzonApiKey: !!dbUser?.api_key_ozon,
          },
          stats: { totalProducts, triggeredToday: dbUser?.triggered_today || 0 },
          referral: { code: dbUser?.referral_code, referredBy: dbUser?.referred_by },
        });
      }

      // ========== HEALTH ==========
      case 'health': {
        const dbResult = await sql`SELECT 1 as ok`;
        return res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: dbResult.rows[0]?.ok === 1 ? 'connected' : 'error',
          version: '3.0.0-refactored',
        });
      }

      // ========== INIT-DB ==========
      case 'init-db': {
        const adminKey = req.headers['x-admin-key'] as string;
        if (!ADMIN_API_KEY || adminKey !== ADMIN_API_KEY) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        await initializeDatabase();
        return res.json({ success: true, message: 'Database initialized' });
      }

      // ========== PLANS ==========
      case 'plans': {
        const plans = Object.entries(SUBSCRIPTION_PLANS).map(([id, plan]) => ({
          id,
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
          maxProducts: plan.maxProducts,
          features: plan.features,
        }));
        return res.json({ plans });
      }

      // ========== AGENT-STATUS ==========
      case 'agent-status': {
        return res.json({
          available: !!OPENAI_API_KEY,
          model: 'gpt-4o-mini',
          capabilities: ['Статистика продаж', 'Управление ценами', 'Защита товаров'],
        });
      }

      // ========== DEFAULT — Forward to legacy handler ==========
      default: {
        // For actions not yet migrated, return error with available actions
        // In production: forward to legacy handler or return 400
        return res.status(400).json({
          error: 'Action requires migration',
          action,
          migratedActions: ['auth', 'health', 'init-db', 'plans', 'agent-status'],
          hint: 'Use legacy index.ts for other actions during migration',
        });
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
