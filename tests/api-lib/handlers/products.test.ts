import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSyncProducts } from '../../../src/api-lib/handlers/products.js';
import { marketplaceService } from '../../../src/api-lib/core-services/MarketplaceService.js';
import { productRepository } from '../../../src/api-lib/repositories/ProductRepository.js';
import { getUserById } from '../../../src/api-lib/services/index.js';

// Mock @vercel/postgres
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}));

// Mock dependencies
vi.mock('../../../src/api-lib/core-services/MarketplaceService.js');
vi.mock('../../../src/api-lib/repositories/ProductRepository.js');
vi.mock('../../../src/api-lib/repositories/UserRepository.js');

// Mock Services index
vi.mock('../../../src/api-lib/services/index.js', async importOriginal => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    getUserById: vi.fn(),
    getProductsByUserId: vi.fn(),
    updateProductMinPrice: vi.fn(),
    updateProductCostPrice: vi.fn(),
  };
});

// Mock Lib index - CRITICAL for isSubscriptionActive
vi.mock('../../../src/api-lib/lib/index.js', () => ({
  sanitizeInput: (s: string) => s,
  isSubscriptionActive: vi.fn(() => true),
  getProductLimit: vi.fn(() => 100),
  decryptApiKey: vi.fn(k => `decrypted_${k}`),
}));

// Mock Users service
vi.mock('../../../src/api-lib/services/users.js', () => ({
  getMarketplaceAccounts: vi.fn(() => []),
  getAccountById: vi.fn(),
}));

// Mock Vercel Request/Response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockReq = (method: string, body: any = {}, query: any = {}) => ({
  method,
  body,
  query,
});

const createMockRes = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('Products Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSyncProducts', () => {
    it('should sync products using MarketplaceService', async () => {
      const mockUser = { id: 1, subscription_plan: 'pro', api_key_wb: 'encrypted_wb_key' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getUserById as any).mockResolvedValue(mockUser);

      const mockProducts = [
        {
          product_id: 'wb-123',
          nm_id: 123,
          current_price: 1000,
          marketplace: 'WB',
          title: 'Test',
          image_url: 'img',
          current_stock: 10,
        },
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (marketplaceService.fetchProducts as any).mockResolvedValue(mockProducts);

      const req = createMockReq('POST', { marketplace: 'WB' });
      const res = createMockRes();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSyncProducts(req as any, res as any, 1);

      // В новой реализации fetchProducts вызывается БЕЗ accountId для Legacy Sync, если аккаунтов нет
      expect(marketplaceService.fetchProducts).toHaveBeenCalledWith(1, 'WB', 100);

      // В saveBatch передаются продукты
      expect(productRepository.saveBatch).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([expect.objectContaining({ product_id: 'wb-123' })])
      );

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, count: 1 }));
    });
  });
});
