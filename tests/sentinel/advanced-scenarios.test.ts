/**
 * 🛡️ SENTINEL ADVANCED SCENARIO TESTS
 *
 * High-quality integration tests for complex market scenarios.
 * Checks Threat Detection and Defense Execution logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreatDetector, ThreatType } from '../../src/sentinel/ThreatDetector.js';
import { SentinelDefenseExecutor } from '../../src/sentinel/DefenseExecutor.js';
import type { DBUser, DBProduct } from '../../src/api-lib/lib/types.js';
import type { SentinelRunResult } from '../../src/sentinel/types.js';

// Mocks
vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: vi.fn(),
  logSentinelAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock the correct service used by DefenseExecutor
vi.mock('../../src/api-lib/core-services/MarketplaceService.js', () => ({
  marketplaceService: {
    setZeroStock: vi.fn().mockResolvedValue({ success: true }),
    setDefensePrice: vi.fn().mockResolvedValue({ success: true }),
    updatePrices: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../src/api-lib/services/notifications.js', () => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
  notificationService: {
    sendAlert: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Sentinel Advanced Scenarios', () => {
  const detector = new ThreatDetector();
  const executor = new SentinelDefenseExecutor();

  const MOCK_USER: Partial<DBUser> = {
    id: 1,
    protection_enabled: true,
    defense_mode: 'price_correction',
  };

  const MOCK_PRODUCT: Partial<DBProduct> = {
    id: 101,
    user_id: '1',
    product_id: 'ozon-12345',
    nm_id: '12345',
    title: 'Test Product',
    current_price: 1500,
    min_price: 1200,
    cost_price: 800,
    marketplace: 'Ozon',
    category: 'Electronics',
    is_monitored: true,
    card_discount_buffer: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Critical Price Drop (Stop-Loss)', () => {
    it('should detect critical threat and execute defense when price is below min_price', async () => {
      // Live price is 1000, while min_price is 1200
      const livePrice = 1000;

      const scan = detector.scanProductThreats(
        MOCK_PRODUCT as unknown as DBProduct,
        livePrice,
        'Ozon'
      );

      expect(scan.hasThreats).toBe(true);
      const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);
      expect(stopLossThreat).toBeDefined();
      expect(stopLossThreat?.severity).toBe('critical');

      // Test Defense Execution
      const summary: SentinelRunResult = {
        actionsTaken: 0,
        errors: [],
        threatsDetected: 0,
        usersProcessed: 0,
        productsScanned: { wb: 0, ozon: 0 },
      };
      await executor.executeDefense(
        MOCK_USER as unknown as DBUser,
        MOCK_PRODUCT as unknown as DBProduct,
        livePrice,
        'Ozon',
        summary,
        ThreatType.COMPETITOR_PRICE_DROP
      );

      const { marketplaceService } =
        await import('../../src/api-lib/core-services/MarketplaceService.js');
      expect(marketplaceService.setDefensePrice).toHaveBeenCalled();
      expect(summary.actionsTaken).toBe(1);
    });
  });

  describe('Scenario 2: Ozon Card Erosion', () => {
    it('should detect high-severity threat when card discount eats too much margin', async () => {
      // Price is 1300. Min is 1200.
      // If Ozon Card takes 15%, 1300 * 0.85 = 1105 < 1200 (Min Price)
      const livePrice = 1300;

      const scan = detector.scanProductThreats(
        { ...MOCK_PRODUCT, current_price: 1300 } as unknown as DBProduct,
        livePrice,
        'Ozon'
      );

      expect(scan.hasThreats).toBe(true);
      expect(scan.threats.some(t => t.type === ThreatType.OZON_CARD_EROSION)).toBe(true);
    });
  });

  describe('Scenario 3: Zero Stock Defense Mode', () => {
    it('should set stock to zero when defense_mode is zero_stock', async () => {
      const userWithZeroStock = { ...MOCK_USER, defense_mode: 'zero_stock' };
      const livePrice = 900; // Critical drop

      const summary: SentinelRunResult = {
        actionsTaken: 0,
        errors: [],
        threatsDetected: 0,
        usersProcessed: 0,
        productsScanned: { wb: 0, ozon: 0 },
      };
      await executor.executeDefense(
        userWithZeroStock as unknown as DBUser,
        { ...MOCK_PRODUCT, current_price: 950 } as unknown as DBProduct,
        livePrice,
        'Ozon',
        summary,
        ThreatType.COMPETITOR_PRICE_DROP
      );

      const { marketplaceService } =
        await import('../../src/api-lib/core-services/MarketplaceService.js');
      expect(marketplaceService.setZeroStock).toHaveBeenCalled();
      expect(summary.actionsTaken).toBe(1);
    });
  });

  describe('Scenario 4: Effective Min Price (Buffer)', () => {
    it('should include card_discount_buffer in calculations', async () => {
      // Min Price: 1000. Buffer: 10%. Effective Min: 1100.
      const productWithBuffer = {
        ...MOCK_PRODUCT,
        current_price: 1050, // Match livePrice to avoid DB_PRICE_MISMATCH
        min_price: 1000,
        card_discount_buffer: 10,
      };
      const livePrice = 1050; // Below effective 1100, but above 1000.

      const scan = detector.scanProductThreats(
        productWithBuffer as unknown as DBProduct,
        livePrice,
        'Ozon'
      );

      expect(scan.hasThreats).toBe(true);
      const stopLossThreat = scan.threats.find(t => t.type === ThreatType.COMPETITOR_PRICE_DROP);
      expect(stopLossThreat?.message).toContain('упала ниже Stop-Loss с учетом буфера (1100₽)');
    });
  });

  describe('Scenario 5: DB Price Mismatch (Anomaly)', () => {
    it('should detect if price on marketplace is 50% different from DB', async () => {
      // DB: 1500, Live: 700.
      const livePrice = 700;

      const scan = detector.scanProductThreats(
        MOCK_PRODUCT as unknown as DBProduct,
        livePrice,
        'Ozon'
      );

      expect(scan.hasThreats).toBe(true);
      expect(scan.threats.some(t => t.type === ThreatType.DB_PRICE_MISMATCH)).toBe(true);
    });
  });
});
