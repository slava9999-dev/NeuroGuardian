// ============================================
// NeuroGUARDIAN — Telegram Authentication
// HMAC-SHA256 validation for Telegram WebApp
// ============================================

import * as crypto from 'crypto';
import type { TelegramUser, InitDataValidationResult } from './types.js';
import { TELEGRAM_BOT_TOKEN, IS_PRODUCTION, DEMO_USER } from './constants.js';

/**
 * Validates Telegram WebApp initData using HMAC-SHA256
 * As per: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): InitDataValidationResult {
  // PRODUCTION MODE: No demo fallback allowed
  if (!initData || initData === '') {
    if (IS_PRODUCTION) {
      return { valid: false, user: null, error: 'Authentication required' };
    }
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
      if (!IS_PRODUCTION) {
        console.warn('⚠️ [DEV] TELEGRAM_BOT_TOKEN not set, skipping signature validation');
        const userJson = params.get('user');
        if (!userJson) {
          return { valid: false, user: null, error: 'Missing user in initData' };
        }
        const user = JSON.parse(userJson) as TelegramUser;
        return { valid: true, user };
      }

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
        console.warn('⚠️ Auth data expired');
        return { valid: false, user: null, error: 'Auth expired, please reload the app' };
      }
    }

    // Extract and parse user
    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false, user: null, error: 'Missing user in initData' };
    }

    const user = JSON.parse(userJson) as TelegramUser;

    // Validate user ID
    if (!user.id || typeof user.id !== 'number' || user.id <= 0) {
      return { valid: false, user: null, error: 'Invalid user ID' };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('❌ Failed to validate initData:', error);
    return { valid: false, user: null, error: 'Failed to parse auth data' };
  }
}

/**
 * Get Telegram user from initData or header
 */
export function extractTelegramUser(
  initData?: string,
  headerInitData?: string
): InitDataValidationResult {
  const data = initData || headerInitData || '';
  return validateTelegramInitData(data);
}
