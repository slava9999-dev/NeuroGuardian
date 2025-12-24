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
    price: 499,
    discountedPrice: 349,
    durationDays: 30,
    maxProducts: 50,
    features: [
      '🧠 AI-агент с голосовым управлением',
      '📊 Продажи и выручка в реальном времени',
      '🛡️ SENTINEL — защита от акций 24/7',
      '📦 До 50 товаров',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Профессиональный',
    price: 999,
    discountedPrice: 699,
    durationDays: 30,
    maxProducts: 500,
    features: [
      '🧠 AI-агент с голосовым управлением',
      '📊 Продажи и выручка в реальном времени',
      '🛡️ SENTINEL — защита от акций 24/7',
      '🔍 Поиск и анализ конкурентов',
      '📦 Синхронизация товаров и остатков',
      '📈 ABC-анализ и прогноз стоков',
      '🧮 Юнит-экономика WB/Ozon',
      '🔐 Шифрование API-ключей (AES-256)',
    ],
  },
  yearly: {
    id: 'yearly',
    name: 'Годовой Pro',
    price: 9990,
    discountedPrice: 9990,
    durationDays: 365,
    maxProducts: 500,
    features: [
      '✅ Все функции Pro',
      '💰 Экономия 2000₽',
      '🎁 2 месяца бесплатно',
      '👑 Персональный менеджер',
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

export const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

export const TEST_MODE = process.env.TEST_MODE === 'true';

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export const API_KEY_ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || '';

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export const ALLOWED_ORIGINS = [
  'https://neuro-guardian.vercel.app',
  'https://neuro-guardian-sos.vercel.app',
  'https://t.me',
  process.env.WEBAPP_URL,
].filter(Boolean) as string[];

// Demo user ONLY for development
export const DEMO_USER = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
};

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
