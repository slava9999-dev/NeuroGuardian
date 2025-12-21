import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { productService } from '../product/product.service';

// Mock the dependencies
vi.mock('../product/product.service', () => ({
  productService: {
    getProductsByUserId: vi.fn(),
  },
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
    vi.clearAllMocks();
  });

  describe('calculateUnitEconomics', () => {
    it('should calculate margins correctly for a profitable product', async () => {
      const mockProduct = {
        product_id: '123',
        user_id: 1,
        title: 'Test Product',
        current_price: 1000,
        marketplace: 'WB',
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      vi.mocked(productService.getProductsByUserId).mockResolvedValue([mockProduct]);

      const result = await analyticsService.calculateUnitEconomics(1, {
        product_id: '123',
        cost_price: 300,
      });

      expect(result.summary.totalProducts).toBe(1);

      const productAnalysis = result.products[0];
      // Hand calculation based on CONSTANTS:
      // Price: 1000
      // Cost: 300
      // Commission (WB 15%): 150
      // Logistics (WB): 70
      // Storage (WB 5*7): 35
      // Tax (6%): 60
      // Total Costs: 300 + 150 + 70 + 35 + 60 = 615
      // Profit: 1000 - 615 = 385
      // Margin: 385 / 1000 = 38.5% -> round to 39% (or 38 if Math.round works that way, let's check code uses Math.round)

      expect(productAnalysis.id).toBe('123');
      expect(productAnalysis.profit).toBe(385);
      expect(productAnalysis.margin).toBe('39%');
      expect(productAnalysis.recommendation).toBe('🟢 OK');
    });

    it('should identify unprofitable products', async () => {
      const mockProduct = {
        product_id: '456',
        user_id: 1,
        title: 'Sad Product',
        current_price: 500,
        marketplace: 'WB',
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      vi.mocked(productService.getProductsByUserId).mockResolvedValue([mockProduct]);

      // High cost price
      const result = await analyticsService.calculateUnitEconomics(1, {
        product_id: '456',
        cost_price: 400,
      });

      // Price: 500
      // Cost: 400
      // Commission (75), Logistics (70), Storage (35), Tax (30) = 210
      // Total Costs: 610
      // Profit: -110

      expect(result.products[0].profit).toBeLessThan(0);
      expect(result.products[0].recommendation).toBe('🔴 Убыточно');
    });
  });

  describe('getAbcAnalysis', () => {
    it('should categorize products into A, B, C classes based on revenue (price)', async () => {
      // Create products with decreasing prices to simulate revenue contribution
      const mockProducts = [
        { product_id: 'p1', current_price: 8000, title: 'P1' }, // 80% (approx)
        { product_id: 'p2', current_price: 1500, title: 'P2' }, // +15% = 95%
        { product_id: 'p3', current_price: 500, title: 'P3' }, // +5% = 100%
      ] as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
      // Total: 10000

      vi.mocked(productService.getProductsByUserId).mockResolvedValue(mockProducts);

      const result = await analyticsService.getAbcAnalysis(1);

      expect(result.items).toHaveLength(3);

      // P1: 8000/10000 = 80% -> A
      expect(result.items.find(p => p.id === 'p1')?.category).toBe('A');

      // P1+P2: 9500/10000 = 95% -> B (strictly if <= 95)
      expect(result.items.find(p => p.id === 'p2')?.category).toBe('B');

      // P3: 10000/10000 = 100% -> C
      expect(result.items.find(p => p.id === 'p3')?.category).toBe('C');
    });
  });
});
