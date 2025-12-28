// ============================================
// NeuroGUARDIAN — Sentinel Logic Tests
// Integration tests for price protection mechanisms
// Version: 1.0.0 | Date: December 2024
// ============================================

// Set NODE_ENV before any imports to enable fallback mode in SecurityAgent
process.env.NODE_ENV = 'test';

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks MUST be defined before importing the module under test
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

vi.mock('../../src/api-lib/services/marketplace.js', () => ({
  getMarketplaceKeys: vi.fn(),
  setOzonZeroStock: vi.fn(),
  setOzonDefensePrice: vi.fn(),
  fetchWbPrices: vi.fn(),
  setWbZeroStock: vi.fn(),
  setWbDefensePrice: vi.fn(),
  fetchOzonCurrentPrices: vi.fn(),
}));

vi.mock('../../src/api-lib/services/database.js', () => ({
  getUserById: vi.fn(),
  logSentinelAction: vi.fn(),
  createOrUpdateUser: vi.fn(),
  getProductsByUserId: vi.fn(),
  updateProductMinPrice: vi.fn(),
}));

vi.mock('../../src/api-lib/services/notifications.js', () => ({
  sendTelegramNotification: vi.fn(),
  notificationService: {
    sendAlert: vi.fn(),
  },
}));

// Mock index.js to re-export mocks
vi.mock('../../src/api-lib/services/index.js', async importOriginal => {
  const marketplace = await import('../../src/api-lib/services/marketplace.js');
  const database = await import('../../src/api-lib/services/database.js');
  const notifications = await import('../../src/api-lib/services/notifications.js');
  return {
    ...marketplace,
    ...database,
    ...notifications,
  };
});

vi.mock('../../src/api-lib/lib/index.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/api-lib/lib/index.js')>();
  return {
    ...actual,
    validateTelegramInitData: vi.fn(() => ({ valid: false })),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Mock SecurityAgent to avoid Vault connection in tests
vi.mock('../../security-agent/src/index.js', () => ({
  getSecurityAgent: vi.fn(() => ({
    isInitialized: vi.fn(() => true),
    initialize: vi.fn(() => Promise.resolve()),
    secrets: {
      get: vi.fn(() => Promise.resolve({ value: 'test-secret' })),
    },
    audit: {
      log: vi.fn(() => Promise.resolve('log-id')),
    },
  })),
}));

// Mock fetch globally for Telegram alerts
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('ok'),
  })
) as any;

// Now import the functions to test (using relative path from test file)
import { handleCheckPrices } from '../../src/api-lib/handlers/sentinel.js';
import * as dbService from '../../src/api-lib/services/index.js';
import { sql } from '@vercel/postgres';

describe('Sentinel Protection Logic', () => {
  const MOCK_USER = {
    id: 1,
    protection_enabled: true,
    subscription_active: true,
    price_buffer_percent: 5,
    warning_threshold_percent: 10,
    defense_mode: 'price_correction',
  };

  const MOCK_KEYS = {
    ozon: { clientId: 'ozon-client', apiKey: 'ozon-key' },
    wb: 'wb-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'super-secret';
    process.env.ADMIN_API_KEY = 'admin-key';
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
  });

  it('should trigger price correction when Ozon price drops below min_price', async () => {
    // 1. Mock Cron Authorization
    const req = {
      headers: { authorization: 'Bearer super-secret' },
      query: {},
      method: 'GET',
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    // 2. Mock DB calls
    // Fetch users
    vi.mocked(sql).mockResolvedValueOnce({ rows: [MOCK_USER] } as any);
    // Fetch keys
    vi.mocked(dbService.getMarketplaceKeys).mockResolvedValue(MOCK_KEYS as any);
    // Fetch monitored products (All together now)
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Cheap iPhone',
          min_price: 1000,
          current_price: 1200,
          marketplace: 'Ozon',
          offer_id: 'OFFER-1',
          updated_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    } as any);

    // 3. Mock Live Price Check
    const livePrices = new Map([[12345, 800]]);
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);

    // 4. Mock Defense Action Success
    vi.mocked(dbService.setOzonDefensePrice).mockResolvedValue({ success: true });

    // 5. Run Sentinel
    await handleCheckPrices(req, res);

    // 6. Assertions
    expect(dbService.setOzonDefensePrice).toHaveBeenCalledWith(
      'ozon-client',
      'ozon-key',
      expect.arrayContaining([expect.objectContaining({ price: 1000 })])
    );

    // Should update current_price in DB
    const updateCall = vi
      .mocked(sql)
      .mock.calls.find(c => c[0][0].includes('UPDATE products SET current_price'));
    expect(updateCall).toBeDefined();

    // Should log the trigger (via database.js mock)
    expect(dbService.logSentinelAction).toHaveBeenCalled();
  });

  it('should skip defense if within 10-minute cooldown', async () => {
    const req = {
      headers: { authorization: 'Bearer super-secret' },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    vi.mocked(sql).mockResolvedValueOnce({ rows: [MOCK_USER] } as any);
    vi.mocked(dbService.getMarketplaceKeys).mockResolvedValue(MOCK_KEYS as any);

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Cool Device',
          min_price: 1000,
          current_price: 1200,
          marketplace: 'Ozon',
          offer_id: 'OFFER-1',
          updated_at: fiveMinsAgo,
        },
      ],
    } as any);

    const livePrices = new Map([[12345, 800]]);
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);

    await handleCheckPrices(req, res);

    expect(dbService.setOzonDefensePrice).not.toHaveBeenCalled();
  });

  it('should respect effectiveMinPrice with card discount buffer', async () => {
    const req = {
      headers: { authorization: 'Bearer super-secret' },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    vi.mocked(sql).mockResolvedValueOnce({ rows: [MOCK_USER] } as any);
    vi.mocked(dbService.getMarketplaceKeys).mockResolvedValue(MOCK_KEYS as any);

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Buffer Test',
          min_price: 1000,
          marketplace: 'Ozon',
          card_discount_buffer: 10, // Effective min = 1100
          offer_id: 'OFFER-1',
          updated_at: new Date(0).toISOString(),
        },
      ],
    } as any);

    const livePrices = new Map([[12345, 1050]]);
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);
    vi.mocked(dbService.setOzonDefensePrice).mockResolvedValue({ success: true });

    await handleCheckPrices(req, res);

    expect(dbService.setOzonDefensePrice).toHaveBeenCalled();
  });
});
