// ============================================
// NeuroGUARDIAN — Test Setup
// Global test configuration
// ============================================

import { vi } from 'vitest';

// Mock environment variables for tests
process.env.POSTGRES_URL = 'postgresql://localhost:5432/test';
process.env.POSTGRES_DATABASE = 'test';
process.env.TELEGRAM_BOT_TOKEN = '123456789:test-bot-token-format';
process.env.ADMIN_TELEGRAM_ID = '123456789';
process.env.ADMIN_CHAT_ID = '123456789';
process.env.API_KEY_ENCRYPTION_KEY = 'test-encryption-key-must-be-very-long-32+!!!';
process.env.ADMIN_API_KEY = 'test-admin-api-key-16+';
process.env.CRON_SECRET = 'test-cron-secret-16+';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.VITE_DEV_MODE = 'true';

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Console spy for debugging - but don't mock implementation so we can see errors
export const consoleSpy = {
  log: vi.spyOn(console, 'log'),
  error: vi.spyOn(console, 'error'),
  warn: vi.spyOn(console, 'warn'),
};
