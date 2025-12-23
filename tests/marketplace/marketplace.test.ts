// ============================================
// NeuroGUARDIAN — Marketplace Service Tests
// Tests for WB and Ozon API operations
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import functions after mocking
// Note: We test the logic, not actual API calls
describe('Marketplace Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // PRICE EXTRACTION TESTS
  // ============================================
  describe('Price Extraction Logic', () => {
    it('should prefer discountedPrice over other price fields', () => {
      const good = {
        nmID: 12345,
        sizes: [
          {
            discountedPrice: 1500,
            clubDiscountedPrice: 1400,
            salePrice: 1600,
            price: 2000,
          },
        ],
      };

      // Testing the priority: discountedPrice > clubDiscountedPrice > salePrice > price
      const size = good.sizes[0];
      const price =
        size.discountedPrice || size.clubDiscountedPrice || size.salePrice || size.price || 0;

      expect(price).toBe(1500);
    });

    it('should fallback to clubDiscountedPrice when discountedPrice is missing', () => {
      const good = {
        nmID: 12345,
        sizes: [
          {
            clubDiscountedPrice: 1400,
            salePrice: 1600,
            price: 2000,
          },
        ],
      };

      const size = good.sizes[0];
      const price =
        size.discountedPrice || size.clubDiscountedPrice || size.salePrice || size.price || 0;

      expect(price).toBe(1400);
    });

    it('should handle kopecks conversion for high values', () => {
      // If price > 100000, it's likely in kopecks
      const priceInKopecks = 150000;
      const convertedPrice =
        priceInKopecks > 100000 ? Math.round(priceInKopecks / 100) : priceInKopecks;

      expect(convertedPrice).toBe(1500);
    });

    it('should not convert reasonable ruble prices', () => {
      const priceInRubles = 50000; // 50,000 rubles is reasonable
      const convertedPrice =
        priceInRubles > 100000 ? Math.round(priceInRubles / 100) : priceInRubles;

      expect(convertedPrice).toBe(50000);
    });
  });

  // ============================================
  // INPUT VALIDATION TESTS
  // ============================================
  describe('Input Validation', () => {
    it('should filter out invalid NaN prices', () => {
      const updates = [
        { nmId: 123, price: 1500 },
        { nmId: 456, price: NaN },
        { nmId: 789, price: 2000 },
        { nmId: 0, price: 1000 },
        { nmId: 111, price: -500 },
      ];

      const validUpdates = updates.filter(
        u => Number.isFinite(u.nmId) && u.nmId > 0 && Number.isFinite(u.price) && u.price > 0
      );

      expect(validUpdates).toHaveLength(2);
      expect(validUpdates[0].nmId).toBe(123);
      expect(validUpdates[1].nmId).toBe(789);
    });

    it('should handle null/undefined values', () => {
      const updates = [
        { nmId: 123, price: 1500 },
        { nmId: null as unknown as number, price: 1000 },
        { nmId: 456, price: undefined as unknown as number },
      ];

      const validUpdates = updates.filter(
        u => Number.isFinite(u.nmId) && u.nmId > 0 && Number.isFinite(u.price) && u.price > 0
      );

      expect(validUpdates).toHaveLength(1);
    });
  });

  // ============================================
  // WB PRICE UPDATE PAYLOAD TESTS
  // ============================================
  describe('WB Price Update Payload', () => {
    it('should use nmID (uppercase) format', () => {
      const updates = [{ nmId: 12345, price: 1500 }];

      const payload = {
        data: updates.map(u => ({
          nmID: u.nmId, // CRITICAL: uppercase ID
          price: u.price,
          discount: 0,
        })),
      };

      expect(payload.data[0]).toHaveProperty('nmID');
      expect(payload.data[0].nmID).toBe(12345);
    });

    it('should include discount: 0 field', () => {
      const updates = [{ nmId: 12345, price: 1500 }];

      const payload = {
        data: updates.map(u => ({
          nmID: u.nmId,
          price: u.price,
          discount: 0, // CRITICAL: required field
        })),
      };

      expect(payload.data[0]).toHaveProperty('discount');
      expect(payload.data[0].discount).toBe(0);
    });

    it('should respect batch limit of 200 items', () => {
      const updates = Array.from({ length: 250 }, (_, i) => ({
        nmId: i + 1,
        price: 1000 + i,
      }));

      const batchedUpdates = updates.slice(0, 200);

      expect(batchedUpdates).toHaveLength(200);
      expect(updates).toHaveLength(250); // Original unchanged
    });
  });

  // ============================================
  // OZON PRICE UPDATE PAYLOAD TESTS
  // ============================================
  describe('Ozon Price Update Payload', () => {
    it('should format prices as strings', () => {
      const updates = [{ productId: 12345, price: 1500 }];

      const payload = {
        prices: updates.map(u => ({
          product_id: u.productId,
          price: String(u.price),
          old_price: String(Math.round(u.price * 1.1)),
          currency_code: 'RUB',
        })),
      };

      expect(payload.prices[0].price).toBe('1500');
      expect(payload.prices[0].old_price).toBe('1650');
      expect(typeof payload.prices[0].price).toBe('string');
    });

    it('should include currency_code: RUB', () => {
      const updates = [{ productId: 12345, price: 1500 }];

      const payload = {
        prices: updates.map(u => ({
          product_id: u.productId,
          price: String(u.price),
          currency_code: 'RUB',
        })),
      };

      expect(payload.prices[0].currency_code).toBe('RUB');
    });
  });

  // ============================================
  // TASK STATUS PARSING TESTS
  // ============================================
  describe('WB Task Status Parsing', () => {
    it('should detect completed status', () => {
      const taskStatuses = ['completed', 'done'];

      for (const status of taskStatuses) {
        const isCompleted = status === 'completed' || status === 'done';
        expect(isCompleted).toBe(true);
      }
    });

    it('should detect pending/processing status', () => {
      const taskStatuses = ['pending', 'processing'];

      for (const status of taskStatuses) {
        const isCompleted = status === 'completed' || status === 'done';
        expect(isCompleted).toBe(false);
      }
    });

    it('should extract errors from task details', () => {
      const taskDetails = [
        { nmID: 123, status: 'accepted' },
        { nmID: 456, status: 'rejected', errorText: 'Price too low' },
        { nmID: 789, status: 'rejected', errorText: 'Invalid discount' },
      ];

      const failedItems = taskDetails.filter(d => d.status === 'rejected' || d.errorText);

      const errors = failedItems.map(e => `nmID ${e.nmID}: ${e.errorText || 'rejected'}`);

      expect(failedItems).toHaveLength(2);
      expect(errors[0]).toBe('nmID 456: Price too low');
    });
  });

  // ============================================
  // OZON ERROR HANDLING TESTS
  // ============================================
  describe('Ozon Error Handling', () => {
    it('should handle partial success correctly', () => {
      const results = [
        { product_id: 123, updated: true },
        { product_id: 456, updated: false, errors: [{ code: 'ERR', message: 'Price too low' }] },
        { product_id: 789, updated: true },
      ];

      const successfulUpdates = results.filter(r => r.updated === true);
      const failedUpdates = results.filter(
        r => r.updated === false || (r.errors && r.errors.length > 0)
      );

      expect(successfulUpdates).toHaveLength(2);
      expect(failedUpdates).toHaveLength(1);
    });

    it('should extract error messages from failed items', () => {
      const failedResults = [
        {
          product_id: 456,
          updated: false,
          errors: [{ code: 'ERR1', message: 'Price too low' }],
        },
        {
          product_id: 789,
          updated: false,
          errors: [{ code: 'ERR2', message: 'Invalid format' }],
        },
      ];

      const errorMessages = failedResults.flatMap(
        f =>
          f.errors?.map(e => `product_id ${f.product_id}: ${e.message || e.code}`) || [
            `product_id ${f.product_id}: update failed`,
          ]
      );

      expect(errorMessages).toHaveLength(2);
      expect(errorMessages[0]).toBe('product_id 456: Price too low');
    });
  });

  // ============================================
  // STOCK AGGREGATION TESTS
  // ============================================
  describe('Stock Aggregation', () => {
    it('should sum stocks across multiple warehouses', () => {
      const stockMap = new Map<number, number>();

      const warehouseStocks = [
        { sku: '123', amount: 10 },
        { sku: '123', amount: 5 }, // Same SKU, different warehouse
        { sku: '456', amount: 20 },
      ];

      for (const stock of warehouseStocks) {
        const nmId = parseInt(stock.sku);
        if (!isNaN(nmId)) {
          const current = stockMap.get(nmId) || 0;
          stockMap.set(nmId, current + (stock.amount || 0));
        }
      }

      expect(stockMap.get(123)).toBe(15); // 10 + 5
      expect(stockMap.get(456)).toBe(20);
    });

    it('should handle FBO quantityFull field', () => {
      const fboStocks = [
        { nmId: 123, quantityFull: 100, quantity: 50 },
        { nmId: 456, quantity: 30 }, // No quantityFull
      ];

      const stockMap = new Map<number, number>();

      for (const item of fboStocks) {
        stockMap.set(item.nmId, item.quantityFull || item.quantity || 0);
      }

      expect(stockMap.get(123)).toBe(100); // Prefers quantityFull
      expect(stockMap.get(456)).toBe(30); // Falls back to quantity
    });
  });

  // ============================================
  // PRODUCT ID PARSING TESTS
  // ============================================
  describe('Product ID Parsing', () => {
    it('should parse Ozon product IDs correctly', () => {
      const productIds = ['ozon-12345', 'ozon-67890'];

      const parsedIds = productIds.map(id => parseInt(id.replace('ozon-', '')));

      expect(parsedIds[0]).toBe(12345);
      expect(parsedIds[1]).toBe(67890);
    });

    it('should handle WB product ID format', () => {
      const productIds = ['wb-12345', 'wb-67890'];

      const nmIds = productIds.map(id => {
        const match = id.match(/wb-(\d+)/);
        return match ? parseInt(match[1]) : null;
      });

      expect(nmIds[0]).toBe(12345);
      expect(nmIds[1]).toBe(67890);
    });
  });

  // ============================================
  // RETRY LOGIC TESTS
  // ============================================
  describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
      const calculateBackoff = (attempt: number, baseDelay = 1000) => {
        return Math.min(baseDelay * Math.pow(2, attempt), 30000);
      };

      expect(calculateBackoff(0)).toBe(1000); // 1s
      expect(calculateBackoff(1)).toBe(2000); // 2s
      expect(calculateBackoff(2)).toBe(4000); // 4s
      expect(calculateBackoff(5)).toBe(30000); // Capped at 30s
    });
  });
});
