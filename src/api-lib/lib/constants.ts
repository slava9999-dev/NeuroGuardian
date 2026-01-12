// ============================================
// NeuroGUARDIAN — Constants
// Shared configuration values
// ============================================

import type { SubscriptionPlan, PlanId } from './types.js';

// ============================================
// SUBSCRIPTION PLANS
// ============================================

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  basic: {
    id: 'basic',
    name: 'Базовый',
    price: 999,
    discountedPrice: 999,
    durationDays: 30,
    maxProducts: 50,
    features: [
      '🧠 Полный AI ассистент Viktor',
      '🛡️ SENTINEL — защита цен 24/7',
      '📊 Мониторинг до 50 товаров',
      '🏪 1 магазин',
      '🔔 Умные уведомления',
      '📈 ABC-анализ',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Профессиональный',
    price: 2999,
    discountedPrice: 2999,
    durationDays: 30,
    maxProducts: 500,
    features: [
      '✅ Всё из Базового',
      '📦 До 500 товаров',
      '🏪 3 магазина',
      '💬 Приоритетная поддержка',
      '📊 Расширенная аналитика',
      '📈 Прогнозы продаж',
      '🔐 Шифрование API-ключей (AES-256)',
    ],
  },
  yearly: {
    id: 'yearly',
    name: 'Pro Годовой',
    price: 29990,
    discountedPrice: 29990,
    durationDays: 365,
    maxProducts: 500,
    features: [
      '✅ Все функции Pro на год',
      '💰 Экономия 6000₽ (~2 месяца бесплатно)',
      '👑 Приоритетная поддержка',
    ],
  },
};

// ============================================
// REFERRAL & PROMO
// ============================================

export const REFERRAL_BONUS_DAYS = 30; // 1 month free for referrer
export const REFERRAL_DISCOUNT_PERCENT = 20; // 20% discount for referred user

// Promo codes - reserved for future use
export const PROMO_CODES: Record<string, { discount: number }> = {
  LAUNCH10: { discount: 10 },
  NEURO20: { discount: 20 },
};

// ============================================
// RATE LIMITING
// ============================================

export const RATE_LIMIT = 100; // requests per window
export const RATE_LIMIT_STRICT = 20; // stricter limit for sensitive actions
export const RATE_WINDOW = 60 * 1000; // 1 minute

// ============================================
// ENVIRONMENT
// ============================================

const _testMode = process.env.TEST_MODE === 'true';
const _isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// In production TEST_MODE is ALWAYS false, even if env var is set
export const TEST_MODE = _isProduction ? false : _testMode;
export const IS_PRODUCTION = _isProduction;

if (typeof process !== 'undefined' && _isProduction && _testMode) {
  console.error(
    '🚨 SECURITY WARNING: TEST_MODE=true was set in production environment. ' +
      'This has been automatically disabled for safety. ' +
      'Remove TEST_MODE from production environment variables.'
  );
}

// Remove or protect DEMO_USER
export const DEMO_USER = _isProduction
  ? null
  : {
      id: 999,
      username: 'demo_user',
      is_admin: false,
    };

// ============================================
// SECRETS — DEPRECATED EXPORTS
// ============================================
// These are deprecated and will be removed in future versions.
// Use getSecret() from './secrets-helper.js' instead.
// Example:
//   import { getSecret } from './secrets-helper.js';
//   const token = await getSecret('telegram_bot_token', 'my_purpose');

/**
 * @deprecated Use getSecret('telegram_bot_token') instead
 */
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/**
 * @deprecated Use getSecret('api_key_encryption_key') instead
 */
const _encKey = process.env.API_KEY_ENCRYPTION_KEY;

if (IS_PRODUCTION && !_encKey) {
  // CRITICAL SECURITY: Fail fast if encryption key is missing in production
  throw new Error(
    '🚨 FATAL: API_KEY_ENCRYPTION_KEY is missing in production environment! System shutdown initiated to prevent insecure data handling.'
  );
}

if (!_encKey && !TEST_MODE) {
  console.warn(
    '⚠️ WARNING: API_KEY_ENCRYPTION_KEY not set. Secrets will not be encrypted properly.'
  );
}
export const API_KEY_ENCRYPTION_KEY = _encKey || '';

export const ALLOWED_ORIGINS = [
  'https://neuro-guardian.vercel.app',
  'https://neuro-guardian-sos.vercel.app',
  'https://t.me',
  process.env.WEBAPP_URL,
].filter(Boolean) as string[];

// NOTE: DEMO_USER removed for production safety (AUDIT-2025-12-28)
// All authentication must go through Telegram WebApp validation

// ============================================
// AI AGENT
// ============================================

export const DEFAULT_MODEL = 'gpt-4o-mini' as const;
export const PREMIUM_MODEL = 'gpt-4o' as const;
export const MAX_TOKENS = 1500;

// ============================================
// LOGGING
// ============================================

if (TEST_MODE) {
  console.log('🧪 TEST MODE ENABLED: All users get Pro subscription for free');
}
