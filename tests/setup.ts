// ============================================
// NeuroGUARDIAN — Test Setup
// Global test configuration
// ============================================

import { vi } from 'vitest';

// Mock environment variables
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.YOOKASSA_SHOP_ID = 'test-shop-id';
process.env.YOOKASSA_SECRET_KEY = 'test-secret-key';

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Console spy for debugging
export const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
};
