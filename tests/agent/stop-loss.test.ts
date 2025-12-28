// ============================================
// NeuroGUARDIAN — Stop Loss Tool Tests
// Integration tests for executeSetStopLoss logic
// Version: 1.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSetStopLoss } from '../../src/api-lib/agent/tool-executors.js';
import * as dbService from '../../src/api-lib/services/database.js';

// Mock database service
vi.mock('../../src/api-lib/services/database.js', () => ({
  getProductsByUserId: vi.fn(),
  // Re-export other things if needed, but we only need getProductsByUserId for this tool
}));

describe('executeSetStopLoss', () => {
  const MOCK_USER_ID = 123456789;
  const MOCK_PRODUCT = {
    product_id: 'test-product-123',
    title: 'Тестовый товар',
    current_price: 1000,
    min_price: 0,
    marketplace: 'WB',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate stop-loss by absolute price', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue([MOCK_PRODUCT] as any);

    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'test-product-123',
      min_price: 850,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      product_id: 'test-product-123',
      min_price: 850,
      current_price: 1000,
    });
  });

  it('should calculate stop-loss by percentage', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue([MOCK_PRODUCT] as any);

    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'test-product-123',
      percentage: 15,
    });

    expect(result.success).toBe(true);
    // 1000 * (1 - 0.15) = 850
    expect(result.data).toMatchObject({
      min_price: 850,
    });
  });

  it('should use default 10% if no price or percentage provided', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue([MOCK_PRODUCT] as any);

    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'test-product-123',
    });

    expect(result.success).toBe(true);
    // 1000 * 0.9 = 900
    expect(result.data).toMatchObject({
      min_price: 900,
    });
  });

  it('should return error if product not found', async () => {
    vi.mocked(dbService.getProductsByUserId).mockResolvedValue([] as any);

    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'non-existent',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('не найден');
  });

  it('should fail on invalid arguments (Zod validation)', async () => {
    // missing product_id
    const result = await executeSetStopLoss(MOCK_USER_ID, {
      min_price: 500,
    });

    expect(result.success).toBe(false);
    // Zod returns "Invalid input" when field is missing
    expect(result.error).toContain('product_id');
  });

  it('should fail on negative price', async () => {
    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'test',
      min_price: -100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('min_price: Minimum price must be positive');
  });

  it('should fail on too high percentage (>50%)', async () => {
    const result = await executeSetStopLoss(MOCK_USER_ID, {
      product_id: 'test',
      percentage: 60,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('percentage: Percentage cannot exceed 50%');
  });
});
