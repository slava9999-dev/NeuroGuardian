// ============================================
// Promo Violation Alert Tests
// Tests threat detection for marketplace promotions
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThreatDetector, ThreatType, type Threat } from '../../src/sentinel/ThreatDetector.js';
import type { DBProduct } from '../../src/api-lib/lib/types.js';

// Mock threat history service
vi.mock('../../src/api-lib/services/validation-log.service.js', () => ({
  threatHistoryService: {
    logThreat: vi.fn().mockResolvedValue(1),
  },
}));

// Mock advanced threat detector
vi.mock('../../src/sentinel/AdvancedThreatDetector.js', () => ({
  advancedThreatDetector: {
    detectAdvancedThreats: vi.fn().mockReturnValue({
      isThreat: false,
      threatType: null,
      confidence: 'low',
      reasoning: [],
    }),
  },
}));

describe('Promo Violation Alerts', () => {
  let detector: ThreatDetector;

  beforeEach(() => {
    detector = new ThreatDetector();
  });

  const createProduct = (overrides: Partial<DBProduct> = {}): DBProduct =>
    ({
      id: 1,
      user_id: 'test-user',
      product_id: 'wb-123456789',
      nm_id: '123456789',
      title: 'Тестовый товар',
      marketplace: 'WB',
      current_price: 1500,
      min_price: 1200,
      estimated_buyer_price: null,
      cost_price: 800,
      current_stock: 10,
      is_monitored: true,
      account_id: 1,
      ...overrides,
    }) as DBProduct;

  describe('BUYER_PRICE_BELOW_STOPLOSS Detection', () => {
    it('should detect when buyer price is below stop-loss', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 1200,
        estimated_buyer_price: 1100, // Below min_price!
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      expect(result.hasThreats).toBe(true);
      expect(
        result.threats.some((t: Threat) => t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS)
      ).toBe(true);
    });

    it('should NOT flag when buyer price is above stop-loss', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 1200,
        estimated_buyer_price: 1300, // Above min_price
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      const buyerPriceThreats = result.threats.filter(
        (t: Threat) =>
          t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS ||
          t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(buyerPriceThreats.length).toBe(0);
    });
  });

  describe('PROMO_PRICE_VIOLATION Detection', () => {
    it('should detect promo violation with significant discount', () => {
      const product = createProduct({
        current_price: 2000, // Seller price
        min_price: 1500,
        estimated_buyer_price: 1400, // 30% discount = promo active
      });

      const result = detector.scanProductThreats(product, 2000, 'WB');

      expect(result.hasThreats).toBe(true);

      const promoThreat = result.threats.find(
        (t: Threat) => t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(promoThreat).toBeDefined();
      expect(promoThreat?.severity).toBe('critical');
      expect(promoThreat?.message).toContain('АКЦИЯ');
    });

    it('should include discount percentage in threat data', () => {
      const product = createProduct({
        current_price: 2000,
        min_price: 1500,
        estimated_buyer_price: 1200, // 40% discount
      });

      const result = detector.scanProductThreats(product, 2000, 'WB');

      const promoThreat = result.threats.find(
        (t: Threat) => t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(promoThreat?.data).toHaveProperty('discountPercent');
      expect((promoThreat?.data as Record<string, number>).discountPercent).toBe(40);
    });

    it('should classify as BUYER_PRICE_BELOW_STOPLOSS for small discounts', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 1200,
        estimated_buyer_price: 1150, // Only ~3% discount, not promo
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      // Small discount but still below stop-loss
      const threats = result.threats.filter(
        (t: Threat) => t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS
      );
      expect(threats.length).toBeGreaterThan(0);
    });
  });

  describe('Ozon Card / WB Wallet Scenarios', () => {
    it('should detect Ozon Card erosion affecting buyer price', () => {
      // Ozon Card gives 5% cashback, but seller pays for it
      const product = createProduct({
        marketplace: 'Ozon',
        product_id: 'ozon-987654321',
        current_price: 1500,
        min_price: 1400,
        estimated_buyer_price: 1350, // After Ozon Card
        cost_price: 1000,
      });

      const result = detector.scanProductThreats(product, 1500, 'Ozon');

      expect(result.hasThreats).toBe(true);
    });

    it('should detect WB Wallet discount affecting stop-loss', () => {
      const product = createProduct({
        marketplace: 'WB',
        current_price: 2000,
        min_price: 1800,
        estimated_buyer_price: 1700, // WB Wallet discount
      });

      const result = detector.scanProductThreats(product, 2000, 'WB');

      expect(result.hasThreats).toBe(true);
      expect(
        result.threats.some(
          (t: Threat) =>
            t.type === ThreatType.PROMO_PRICE_VIOLATION ||
            t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS
        )
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing estimated_buyer_price gracefully', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 1200,
        estimated_buyer_price: null,
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      // Should not crash, and should not produce buyer price threats
      const buyerPriceThreats = result.threats.filter(
        (t: Threat) =>
          t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS ||
          t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(buyerPriceThreats.length).toBe(0);
    });

    it('should handle zero min_price (no stop-loss set)', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 0, // No stop-loss
        estimated_buyer_price: 1000, // Low buyer price
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      // No buyer price threats because min_price is 0
      const buyerPriceThreats = result.threats.filter(
        (t: Threat) =>
          t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS ||
          t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(buyerPriceThreats.length).toBe(0);
    });

    it('should handle estimated_buyer_price of 0', () => {
      const product = createProduct({
        current_price: 1500,
        min_price: 1200,
        estimated_buyer_price: 0, // Invalid/missing
      });

      const result = detector.scanProductThreats(product, 1500, 'WB');

      // Should not produce buyer price threats for 0 value
      const buyerPriceThreats = result.threats.filter(
        (t: Threat) =>
          t.type === ThreatType.BUYER_PRICE_BELOW_STOPLOSS ||
          t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(buyerPriceThreats.length).toBe(0);
    });
  });

  describe('Threat Severity', () => {
    it('should mark promo violations as critical', () => {
      const product = createProduct({
        current_price: 2000,
        min_price: 1500,
        estimated_buyer_price: 1300,
      });

      const result = detector.scanProductThreats(product, 2000, 'WB');

      const promoThreat = result.threats.find(
        (t: Threat) => t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(promoThreat?.severity).toBe('critical');
    });

    it('should include nmId in threat for WB products', () => {
      const product = createProduct({
        nm_id: '123456789',
        current_price: 2000,
        min_price: 1500,
        estimated_buyer_price: 1300,
      });

      const result = detector.scanProductThreats(product, 2000, 'WB');

      const threat = result.threats.find(
        (t: Threat) => t.type === ThreatType.PROMO_PRICE_VIOLATION
      );
      expect(threat?.nmId).toBe('123456789');
    });
  });

  describe('logThreatsToHistory', () => {
    it('should log threats to history without errors', async () => {
      const threats: Threat[] = [
        {
          type: ThreatType.PROMO_PRICE_VIOLATION,
          severity: 'critical' as const,
          productId: 'wb-123',
          nmId: '123456789',
          message: 'Test threat',
          data: { test: true },
        },
      ];

      // Should not throw
      await expect(
        detector.logThreatsToHistory('test-user', threats, 'WB')
      ).resolves.toBeUndefined();
    });
  });
});
