// ============================================
// NeuroGUARDIAN — Smart Defaults Service Tests
// Tests for auto-calculation of protection settings
// ============================================

import { describe, it, expect } from 'vitest';
import { smartDefaultsService } from '../../src/api-lib/core-services/SmartDefaultsService.js';
import type { ProductForDefaults } from '../../src/api-lib/core-services/SmartDefaultsService.js';

describe('SmartDefaultsService', () => {
  describe('calculateDefaults', () => {
    it('should calculate min_price based on category margin', () => {
      const product: ProductForDefaults = {
        productId: 'test-1',
        currentPrice: 1000,
        marketplace: 'WB',
        title: 'Платье женское',
        category: 'одежда',
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // Clothing has 35% margin, so min should be around 65% * 1.1 = 71.5% of price
      expect(defaults.minPrice).toBeLessThan(product.currentPrice);
      expect(defaults.minPrice).toBeGreaterThan(0);
      expect(defaults.confidence).toBeGreaterThanOrEqual(0.6);
      expect(defaults.sppBufferPercent).toBeGreaterThan(0);
    });

    it('should use cost price when provided for higher confidence', () => {
      const product: ProductForDefaults = {
        productId: 'test-2',
        currentPrice: 1000,
        marketplace: 'Ozon',
        title: 'Товар с себестоимостью',
        costPrice: 400, // Known cost
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // min_price = costPrice * 1.15 = 460
      expect(defaults.minPrice).toBe(460);
      expect(defaults.confidence).toBe(0.95);
      expect(defaults.reasoning).toContain('себестоимости');
    });

    it('should cap min_price at 80% of current price', () => {
      const product: ProductForDefaults = {
        productId: 'test-3',
        currentPrice: 100,
        marketplace: 'WB',
        title: 'Дешёвый товар',
        costPrice: 90, // Very high cost
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // Even with high cost, min_price should not exceed 80% of current
      expect(defaults.minPrice).toBeLessThanOrEqual(80);
    });

    it('should set correct SPP buffer for WB', () => {
      const product: ProductForDefaults = {
        productId: 'test-4',
        currentPrice: 500,
        marketplace: 'WB',
        title: 'Test',
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // WB: avgPlatformDiscount (20%) + safetyBuffer (5%) = 25%
      expect(defaults.sppBufferPercent).toBe(25);
    });

    it('should set correct SPP buffer for Ozon', () => {
      const product: ProductForDefaults = {
        productId: 'test-5',
        currentPrice: 500,
        marketplace: 'Ozon',
        title: 'Test',
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // Ozon: avgPlatformDiscount (22%) + safetyBuffer (5%) = 27%
      expect(defaults.sppBufferPercent).toBe(27);
    });

    it('should select zero_stock for high-margin products', () => {
      const product: ProductForDefaults = {
        productId: 'test-6',
        currentPrice: 1000,
        marketplace: 'WB',
        title: 'Крем для лица',
        category: 'косметика', // High margin category
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      expect(defaults.protectionMode).toBe('zero_stock');
    });

    it('should select price_correction for low-margin products', () => {
      const product: ProductForDefaults = {
        productId: 'test-7',
        currentPrice: 50000,
        marketplace: 'Ozon',
        title: 'Смартфон',
        category: 'электроника',
      };

      const defaults = smartDefaultsService.calculateDefaults(product);

      // Electronics has low margin, should use price_correction
      expect(defaults.protectionMode).toBe('price_correction');
    });
  });

  describe('calculateBatch', () => {
    it('should calculate defaults for multiple products', () => {
      const products: ProductForDefaults[] = [
        { productId: 'p1', currentPrice: 1000, marketplace: 'WB', title: 'Товар 1' },
        { productId: 'p2', currentPrice: 2000, marketplace: 'Ozon', title: 'Товар 2' },
        { productId: 'p3', currentPrice: 500, marketplace: 'WB', title: 'Товар 3' },
      ];

      const results = smartDefaultsService.calculateBatch(products);

      expect(results.size).toBe(3);
      expect(results.has('p1')).toBe(true);
      expect(results.has('p2')).toBe(true);
      expect(results.has('p3')).toBe(true);
    });

    it('should provide fallback for products with errors', () => {
      const products: ProductForDefaults[] = [
        { productId: 'valid', currentPrice: 1000, marketplace: 'WB', title: 'Valid' },
        { productId: 'zero-price', currentPrice: 0, marketplace: 'Ozon', title: 'Zero' }, // Edge case
      ];

      const results = smartDefaultsService.calculateBatch(products);

      expect(results.size).toBe(2);
      // Even zero-price product should get a result (fallback)
      const zeroPriceDefaults = results.get('zero-price');
      expect(zeroPriceDefaults).toBeDefined();
    });
  });

  describe('estimateBreakEvenPrice', () => {
    it('should calculate break-even with known cost price', () => {
      const product: ProductForDefaults = {
        productId: 'test',
        currentPrice: 1000,
        marketplace: 'WB',
        costPrice: 500,
      };

      const breakEven = smartDefaultsService.estimateBreakEvenPrice(product);

      // WB commission ~15%, so break-even = 500 / 0.85 ≈ 589
      expect(breakEven).toBe(589);
    });

    it('should estimate break-even without cost price', () => {
      const product: ProductForDefaults = {
        productId: 'test',
        currentPrice: 1000,
        marketplace: 'Ozon',
      };

      const breakEven = smartDefaultsService.estimateBreakEvenPrice(product);

      // Should be less than current price
      expect(breakEven).toBeLessThan(product.currentPrice);
      expect(breakEven).toBeGreaterThan(0);
    });
  });

  describe('summarize', () => {
    it('should provide summary statistics', () => {
      const products: ProductForDefaults[] = [
        { productId: 'p1', currentPrice: 1000, marketplace: 'WB', costPrice: 500 }, // High confidence
        { productId: 'p2', currentPrice: 2000, marketplace: 'Ozon' }, // Medium confidence
        { productId: 'p3', currentPrice: 500, marketplace: 'WB' }, // Medium confidence
      ];

      const defaults = smartDefaultsService.calculateBatch(products);
      const summary = smartDefaultsService.summarize(defaults);

      expect(summary.totalProducts).toBe(3);
      expect(summary.avgConfidence).toBeGreaterThan(0);
      expect(summary.avgConfidence).toBeLessThanOrEqual(100);
      expect(summary.highConfidence + summary.mediumConfidence + summary.lowConfidence).toBe(3);
    });
  });
});
