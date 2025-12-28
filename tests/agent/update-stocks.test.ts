// ============================================
// NeuroGUARDIAN — Update Stocks Tool Tests
// Integration tests for executeUpdateStocks logic
// Version: 1.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeUpdateStocks } from '../../src/api-lib/agent/tool-executors.js';
import * as dbService from '../../src/api-lib/services/database.js';

// Mock database service
vi.mock('../../src/api-lib/services/database.js', () => ({
  getProductsByUserId: vi.fn(),
}));

describe('executeUpdateStocks', () => {
  const MOCK_USER_ID = 123456789;
  const MOCK_PRODUCTS = [
    {
      product_id: 'wb-product-1',
      nm_id: 111,
      title: 'WB Item',
      current_stock: 50,
      marketplace: 'WB',
    },
    {
      product_id: 'ozon-product-2',
      offer_id: 'OZON-OFFER-2',
      title: 'Ozon Item',
      current_stock: 30,
      marketplace: 'Ozon',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prepare stock updates for valid products', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await executeUpdateStocks(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'wb-product-1', new_stock: 100 }],
    });

    expect(result.success).toBe(true);
    expect(result.data.stock_updates).toHaveLength(1);
    expect(result.data.stock_updates[0]).toMatchObject({
      product_id: 'wb-product-1',
      sku: '111',
      newStock: 100,
      currentStock: 50,
      marketplace: 'WB',
    });
  });

  it('should handle multiple products and mixed marketplaces if requested correctly', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await executeUpdateStocks(MOCK_USER_ID, {
      marketplace: 'Ozon',
      products: [{ product_id: 'ozon-product-2', new_stock: 0 }],
    });

    expect(result.success).toBe(true);
    expect(result.data.stock_updates[0]).toMatchObject({
      product_id: 'ozon-product-2',
      offer_id: 'OZON-OFFER-2',
      newStock: 0,
      currentStock: 30,
      marketplace: 'Ozon',
    });
  });

  it('should return error if no products matched', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await executeUpdateStocks(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'non-existent', new_stock: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Товары для обновления остатков не найдены');
  });

  it('should fail on negative stock value (Zod)', async () => {
    const result = await executeUpdateStocks(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'wb-1', new_stock: -5 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('new_stock: Stock cannot be negative');
  });

  it('should fail if marketplace is missing or invalid', async () => {
    const result = await executeUpdateStocks(MOCK_USER_ID, {
      marketplace: 'AliExpress' as any,
      products: [{ product_id: 'wb-1', new_stock: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('marketplace');
  });
});
