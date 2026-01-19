// ============================================
// NeuroGUARDIAN — Update Stocks Tool Tests
// Integration tests for executeUpdateStocks logic
// Version: 1.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateStocksTool } from '../../src/agent/execution/tools/UpdateStocksTool.js';
import * as dbService from '../../src/api-lib/services/database.js';

// Mock database service
vi.mock('../../src/api-lib/services/database.js', () => ({
  getProductsByUserId: vi.fn(),
}));

// Mock notifications service to prevent circular dependency
vi.mock('../../src/api-lib/services/notifications.js', () => ({
  sendAlert: vi.fn(),
  sendAlertToAdmin: vi.fn(),
  sendAlertToUser: vi.fn(),
  sendHourlyReport: vi.fn(),
  sendDailyReport: vi.fn(),
  sendWelcomeMessage: vi.fn(),
  sendTelegramNotification: vi.fn(),
  notificationService: {
    sendAlert: vi.fn(),
    sendAlertToAdmin: vi.fn(),
    sendAlertToUser: vi.fn(),
    sendHourlyReport: vi.fn(),
    sendDailyReport: vi.fn(),
    sendWelcomeMessage: vi.fn(),
    sendTelegramNotification: vi.fn(),
  },
}));

// Mock orchestrator to prevent circular dependency
vi.mock('../../src/api-lib/agent/orchestrator-v4.js', () => ({
  callLLMWithFallback: vi.fn(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await updateStocksTool.execute(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'wb-product-1', new_stock: 100 }],
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const updates = data.updates as Array<Record<string, unknown>>;
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      product_id: 'wb-product-1',
      title: 'WB Item',
      newStock: 100,
      currentStock: 50,
      marketplace: 'WB',
    });
  });

  it('should handle multiple products and mixed marketplaces if requested correctly', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await updateStocksTool.execute(MOCK_USER_ID, {
      marketplace: 'Ozon',
      products: [{ product_id: 'ozon-product-2', new_stock: 0 }],
    });

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    const updates = data.updates as Array<Record<string, unknown>>;
    expect(updates[0]).toMatchObject({
      product_id: 'ozon-product-2',
      title: 'Ozon Item',
      newStock: 0,
      currentStock: 30,
      marketplace: 'Ozon',
    });
  });

  it('should return error if no products matched', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue(MOCK_PRODUCTS as any);

    const result = await updateStocksTool.execute(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'non-existent', new_stock: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Товары не найдены');
  });

  it('should fail on negative stock value (Zod)', async () => {
    const result = await updateStocksTool.execute(MOCK_USER_ID, {
      marketplace: 'WB',
      products: [{ product_id: 'wb-1', new_stock: -5 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('new_stock: Stock cannot be negative');
  });

  it('should fail if marketplace is missing or invalid', async () => {
    const result = await updateStocksTool.execute(MOCK_USER_ID, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marketplace: 'AliExpress' as any,
      products: [{ product_id: 'wb-1', new_stock: 10 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('marketplace');
  });
});
