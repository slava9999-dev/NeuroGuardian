// ============================================
// NeuroGUARDIAN — Agent Orchestrator Tests
// Logic and integration tests for V3 architecture
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as router from '../../src/api-lib/agent/router.js';
import * as database from '../../src/api-lib/services/database.js';
import { orchestrateAgentRequest } from '../../src/api-lib/agent/orchestrator.js';

// Mock dependencies
vi.mock('../../src/api-lib/agent/router.js', () => ({
  routeMessage: vi.fn(),
  getSpecialistConfig: vi
    .fn()
    .mockReturnValue({ model: 'gpt-4o-mini', tools: [], maxTokens: 1000, temperature: 0.7 }),
  isConfirmation: vi.fn().mockReturnValue(false),
  isRejection: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/api-lib/services/database.js', () => ({
  getProductsByUserId: vi.fn(),
  updateProductMinPrice: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: 'Mock response' } }],
    usage: { total_tokens: 100 },
  }),
});

describe('Agent Orchestrator (V3)', () => {
  const mockContext = {
    userId: 123,
    productsCount: 10,
    protectedCount: 5,
    hasWbApi: true,
    hasOzonApi: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default router mock for tests that don't need specific routing
    vi.mocked(router.routeMessage).mockResolvedValue({
      category: 'general',
      confidence: 1.0,
      reasoning: 'Default',
    } as any);
  });

  describe('orchestrateAgentRequest', () => {
    it('should route message and return response from specialist', async () => {
      vi.mocked(router.routeMessage).mockResolvedValue({
        category: 'analytics',
        confidence: 0.9,
        reasoning: 'User asked for sales stats',
      } as any);

      const result = await orchestrateAgentRequest('покажи продажи', mockContext as any, []);

      expect(result.success).toBe(true);
      expect(result.category).toBe('analytics');
      expect(result.content).toBe('Mock response');
    });

    it('should identify confirmation message and process pending action', async () => {
      vi.mocked(router.isConfirmation).mockReturnValue(true);

      const pendingAction = {
        operation: 'set_stop_loss',
        taskId: 'task-123',
        details: { product_id: 'wb-1', min_price: 1000 },
      };

      vi.mocked(database.getProductsByUserId).mockResolvedValue([
        {
          product_id: 'wb-1',
          title: 'Test Product',
          current_price: 1500,
          min_price: 0,
          marketplace: 'WB',
        },
      ] as any);

      const result = await orchestrateAgentRequest('да', mockContext as any, [], pendingAction);

      expect(result.success).toBe(true);
      expect(result.category).toBe('confirmation');
      expect(database.updateProductMinPrice).toHaveBeenCalledWith(123, 'wb-1', 1000);
      expect(result.content).toContain('Stop-Loss установлен');
    });

    it('should handle rejection message and clear pending action', async () => {
      vi.mocked(router.isRejection).mockReturnValue(true);
      vi.mocked(router.isConfirmation).mockReturnValue(false);

      const pendingAction = {
        operation: 'update_prices',
        taskId: 'task-456',
        details: { price_changes: [] },
      };

      const result = await orchestrateAgentRequest('нет', mockContext as any, [], pendingAction);

      expect(result.success).toBe(true);
      expect(result.content).toContain('отменено');
      expect(database.updateProductMinPrice).not.toHaveBeenCalled();
    });
  });
});
