// ============================================
// NeuroGUARDIAN — Sentinel Logic Tests
// Integration tests for price protection mechanisms
// Version: 1.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks MUST be defined before importing the module under test
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

vi.mock('../../src/api-lib/services/index.js', () => ({
  getUserById: vi.fn(),
  getMarketplaceKeys: vi.fn(),
  setOzonZeroStock: vi.fn(),
  setOzonDefensePrice: vi.fn(),
  fetchWbPrices: vi.fn(),
  setWbZeroStock: vi.fn(),
  setWbDefensePrice: vi.fn(),
  fetchOzonCurrentPrices: vi.fn(),
}));

vi.mock('../../src/api-lib/lib/index.js', () => ({
  validateTelegramInitData: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
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
import { handleCheckPrices } from '../../api/handlers/sentinel.js';
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
    // Fetch monitored products (Ozon)
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Cheap iPhone',
          min_price: 1000,
          current_price: 1200,
          offer_id: 'OFFER-1',
          updated_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (not cooldown)
        },
      ],
    } as any);
    // Fetch monitored products (WB) - return empty for now
    vi.mocked(sql).mockResolvedValueOnce({ rows: [] } as any);

    // 3. Mock Live Price Check
    const livePrices = new Map([[12345, 800]]); // Drops to 800, below min_price 1000
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);

    // 4. Mock Defense Action Success
    vi.mocked(dbService.setOzonDefensePrice).mockResolvedValue({ success: true });

    // 5. Run Sentinel
    await handleCheckPrices(req, res);

    // 6. Assertions
    // Should attempt to fix price to min_price (1000)
    expect(dbService.setOzonDefensePrice).toHaveBeenCalledWith(
      'ozon-client',
      'ozon-key',
      expect.arrayContaining([expect.objectContaining({ price: 1000 })])
    );

    // Should log the trigger to sentinel_logs
    const logCall = vi
      .mocked(sql)
      .mock.calls.find(
        call =>
          Array.isArray(call[0]) && call[0].some(part => /INSERT INTO sentinel_logs/i.test(part))
      );
    expect(logCall).toBeDefined();

    // Should update user metrics
    const userUpdateCall = vi
      .mocked(sql)
      .mock.calls.find(
        call =>
          Array.isArray(call[0]) &&
          call[0].some(part => /UPDATE users SET\s+triggered_today/i.test(part))
      );
    expect(userUpdateCall).toBeDefined();

    // Should send Telegram alert (fetch was mocked globally)
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should skip defense if within 10-minute cooldown', async () => {
    const req = {
      headers: { authorization: 'Bearer super-secret' },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    vi.mocked(sql).mockResolvedValueOnce({ rows: [MOCK_USER] } as any);
    vi.mocked(dbService.getMarketplaceKeys).mockResolvedValue(MOCK_KEYS as any);

    // Last updated 5 minutes ago
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Cool Device',
          min_price: 1000,
          current_price: 1200,
          offer_id: 'OFFER-1',
          updated_at: fiveMinsAgo,
        },
      ],
    } as any);
    vi.mocked(sql).mockResolvedValueOnce({ rows: [] } as any);

    const livePrices = new Map([[12345, 800]]);
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);

    await handleCheckPrices(req, res);

    // Should NOT call defense due to cooldown
    expect(dbService.setOzonDefensePrice).not.toHaveBeenCalled();
    expect(dbService.setOzonZeroStock).not.toHaveBeenCalled();
  });

  it('should respect effectiveMinPrice with card discount buffer', async () => {
    const req = {
      headers: { authorization: 'Bearer super-secret' },
      query: {},
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    // Buffer is 10% for this product
    const productWithBuffer = {
      ...MOCK_USER,
      min_price: 1000,
      card_discount_buffer: 10, // 10%
    };

    vi.mocked(sql).mockResolvedValueOnce({ rows: [MOCK_USER] } as any);
    vi.mocked(dbService.getMarketplaceKeys).mockResolvedValue(MOCK_KEYS as any);

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          product_id: 'ozon-12345',
          title: 'Buffer Test',
          min_price: 1000,
          card_discount_buffer: 10, // Effective min = 1100
          offer_id: 'OFFER-1',
          updated_at: new Date(0).toISOString(),
        },
      ],
    } as any);
    vi.mocked(sql).mockResolvedValueOnce({ rows: [] } as any);

    // Current price is 1050.
    // It is ABOVE min_price (1000) but BELOW effective_min (1100).
    // Sentinel SHOULD trigger.
    const livePrices = new Map([[12345, 1050]]);
    vi.mocked(dbService.fetchOzonCurrentPrices).mockResolvedValue(livePrices);
    vi.mocked(dbService.setOzonDefensePrice).mockResolvedValue({ success: true });

    await handleCheckPrices(req, res);

    expect(dbService.setOzonDefensePrice).toHaveBeenCalled();
  });
});
