// ============================================
// NeuroGUARDIAN — Telegram Auth Validation
// ============================================

import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
}

/**
 * Validate Telegram WebApp initData using HMAC-SHA256
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData: string): ParsedInitData | null {
  if (!initData || !BOT_TOKEN) {
    console.warn('Missing initData or BOT_TOKEN');
    return null;
  }

  try {
    // Parse initData as URL-encoded string
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      console.warn('Missing hash in initData');
      return null;
    }

    // Remove hash from params and sort alphabetically
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate HMAC-SHA256
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes
    if (calculatedHash !== hash) {
      console.warn('Invalid initData hash');
      return null;
    }

    // Check auth_date (not older than 24 hours)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.warn('initData is too old');
      return null;
    }

    // Parse user data
    const userJson = params.get('user');
    if (!userJson) {
      console.warn('Missing user in initData');
      return null;
    }

    const user = JSON.parse(userJson) as TelegramUser;

    return {
      user,
      auth_date: authDate,
      hash,
      query_id: params.get('query_id') || undefined,
    };
  } catch (error) {
    console.error('Error validating initData:', error);
    return null;
  }
}

/**
 * For development: skip validation and parse anyway
 */
export function parseInitDataUnsafe(initData: string): ParsedInitData | null {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    
    if (!userJson) return null;
    
    const user = JSON.parse(userJson) as TelegramUser;
    
    return {
      user,
      auth_date: parseInt(params.get('auth_date') || '0', 10),
      hash: params.get('hash') || '',
    };
  } catch {
    return null;
  }
}

/**
 * Send message to Telegram user
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('Missing TELEGRAM_BOT_TOKEN');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
}
