// ============================================
// NeuroGUARDIAN — Telegram Auth Tests
// Tests for Telegram WebApp authentication
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock Telegram user
const DEMO_USER = {
  id: 123456789,
  first_name: 'Demo',
  last_name: 'User',
  username: 'demo_user',
};

// Extracted auth validation logic
function validateTelegramInitData(
  initData: string,
  botToken: string,
  isProduction: boolean = false
): { valid: boolean; user: any; error?: string } {
  // Empty initData handling
  if (!initData || initData === '') {
    if (isProduction) {
      return { valid: false, user: null, error: 'Authentication required' };
    }
    return { valid: true, user: DEMO_USER };
  }

  // Demo mode
  if (initData === 'demo') {
    if (isProduction) {
      return { valid: false, user: null, error: 'Demo mode disabled in production' };
    }
    return { valid: true, user: DEMO_USER };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false, user: null, error: 'Missing hash in initData' };
    }

    if (!botToken) {
      if (!isProduction) {
        const userJson = params.get('user');
        if (!userJson) {
          return { valid: false, user: null, error: 'Missing user in initData' };
        }
        return { valid: true, user: JSON.parse(userJson) };
      }
      return { valid: false, user: null, error: 'Auth system not configured' };
    }

    // Validate signature
    params.delete('hash');
    const checkArr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    const dataCheckString = checkArr.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (hash !== calculatedHash) {
      return { valid: false, user: null, error: 'Invalid signature' };
    }

    const userJson = params.get('user');
    if (!userJson) {
      return { valid: false, user: null, error: 'Missing user in initData' };
    }

    return { valid: true, user: JSON.parse(userJson) };
  } catch (error) {
    return { valid: false, user: null, error: 'Parse error' };
  }
}

// Helper to create valid initData
function createValidInitData(user: any, botToken: string, authDate?: number): string {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(authDate || Math.floor(Date.now() / 1000)));

  // Sort and create check string
  const checkArr = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = checkArr.join('\n');

  // Calculate hash
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}

describe('Telegram Auth', () => {
  const TEST_BOT_TOKEN = 'test-bot-token';

  describe('Empty initData', () => {
    it('should allow demo user in development', () => {
      const result = validateTelegramInitData('', TEST_BOT_TOKEN, false);
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(DEMO_USER);
    });

    it('should reject empty initData in production', () => {
      const result = validateTelegramInitData('', TEST_BOT_TOKEN, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Authentication required');
    });
  });

  describe('Demo mode', () => {
    it('should allow demo mode in development', () => {
      const result = validateTelegramInitData('demo', TEST_BOT_TOKEN, false);
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(DEMO_USER);
    });

    it('should reject demo mode in production', () => {
      const result = validateTelegramInitData('demo', TEST_BOT_TOKEN, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Demo mode disabled in production');
    });
  });

  describe('Valid initData', () => {
    it('should validate correct signature', () => {
      const testUser = { id: 12345, first_name: 'Test', username: 'test' };
      const initData = createValidInitData(testUser, TEST_BOT_TOKEN);

      const result = validateTelegramInitData(initData, TEST_BOT_TOKEN, true);
      expect(result.valid).toBe(true);
      expect(result.user.id).toBe(12345);
    });

    it('should reject invalid signature', () => {
      const testUser = { id: 12345, first_name: 'Test' };
      const initData = createValidInitData(testUser, TEST_BOT_TOKEN);

      // Use different bot token for validation
      const result = validateTelegramInitData(initData, 'wrong-token', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject missing hash', () => {
      const params = new URLSearchParams();
      params.set('user', JSON.stringify({ id: 123 }));

      const result = validateTelegramInitData(params.toString(), TEST_BOT_TOKEN, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing hash in initData');
    });
  });

  describe('Missing bot token', () => {
    it('should skip validation in development if no bot token', () => {
      const testUser = { id: 999, first_name: 'NoToken' };
      const params = new URLSearchParams();
      params.set('user', JSON.stringify(testUser));
      params.set('hash', 'fake-hash');

      const result = validateTelegramInitData(params.toString(), '', false);
      expect(result.valid).toBe(true);
      expect(result.user.id).toBe(999);
    });

    it('should reject in production if no bot token', () => {
      const params = new URLSearchParams();
      params.set('user', JSON.stringify({ id: 123 }));
      params.set('hash', 'fake-hash');

      const result = validateTelegramInitData(params.toString(), '', true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Auth system not configured');
    });
  });
});
