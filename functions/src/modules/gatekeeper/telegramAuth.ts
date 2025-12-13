// ============================================
// NeuroGUARDIAN — Telegram Auth Module
// HMAC-SHA256 validation of initData
// ============================================

import * as crypto from 'crypto';
import { TelegramInitDataSchema, TelegramInitData } from '../../schemas';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/**
 * Parse initData string into object
 */
function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const result: Record<string, string> = {};
  
  for (const [key, value] of params) {
    result[key] = value;
  }
  
  return result;
}

/**
 * Validate Telegram WebApp initData using HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string): boolean {
  if (!initData || !BOT_TOKEN) {
    console.error('Missing initData or BOT_TOKEN');
    return false;
  }
  
  try {
    const parsed = parseInitData(initData);
    const hash = parsed.hash;
    
    if (!hash) {
      console.error('Missing hash in initData');
      return false;
    }
    
    // Remove hash from params and sort alphabetically
    delete parsed.hash;
    const dataCheckString = Object.keys(parsed)
      .sort()
      .map((key) => `${key}=${parsed[key]}`)
      .join('\n');
    
    // Create secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    
    // Calculate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Compare hashes (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(expectedHash)
    );
    
    // Check auth_date is not too old (allow 24 hours)
    if (isValid && parsed.auth_date) {
      const authDate = parseInt(parsed.auth_date, 10);
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 hours
      
      if (now - authDate > maxAge) {
        console.error('initData is too old');
        return false;
      }
    }
    
    return isValid;
  } catch (error) {
    console.error('Error validating initData:', error);
    return false;
  }
}

/**
 * Parse and validate initData, returning typed user data
 */
export function parseAndValidateInitData(initData: string): TelegramInitData | null {
  if (!validateInitData(initData)) {
    return null;
  }
  
  try {
    const parsed = parseInitData(initData);
    
    // Parse user JSON
    if (parsed.user) {
      parsed.user = JSON.parse(parsed.user);
    }
    
    // Validate with Zod
    const result = TelegramInitDataSchema.safeParse({
      query_id: parsed.query_id,
      user: parsed.user,
      auth_date: parseInt(parsed.auth_date, 10),
      hash: parsed.hash,
    });
    
    if (!result.success) {
      console.error('Zod validation failed:', result.error);
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('Error parsing initData:', error);
    return null;
  }
}

/**
 * Extract user ID from initData (for quick checks)
 */
export function extractUserId(initData: string): number | null {
  try {
    const parsed = parseInitData(initData);
    if (parsed.user) {
      const user = JSON.parse(parsed.user);
      return user.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
