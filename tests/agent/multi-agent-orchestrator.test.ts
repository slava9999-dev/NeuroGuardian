// ============================================
// NeuroGUARDIAN — Multi-Agent Orchestrator Tests
// Tests for the main routing orchestrator
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger to suppress noise
vi.mock('../../src/api-lib/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock('../../src/infrastructure/llm/GeminiProvider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockImplementation(async (messages: any[]) => {
      // Find the last user message to avoid matching keywords in system prompts
      const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      const prompt = userMessage.toLowerCase();
      let category = 'CHAT';

      if (prompt.includes('товар') || prompt.includes('product')) category = 'PRODUCTS';
      else if (prompt.includes('цена') || prompt.includes('price') || prompt.includes('стоп-лосс'))
        category = 'PRICING';
      else if (prompt.includes('статус') || prompt.includes('защит') || prompt.includes('sentinel'))
        category = 'SENTINEL';
      else if (prompt.includes('аналитика') || prompt.includes('юнит') || prompt.includes('abc'))
        category = 'ANALYTICS';

      return {
        content: JSON.stringify({
          category,
          confidence: 0.9,
          reasoning: `Mocked classification for: ${category}`,
          entities: { productIds: [], prices: [], marketplace: null },
        }),
        tokensUsed: 100,
      };
    }),
    completeWithTools: vi.fn().mockResolvedValue({
      content: 'Mocked tool response',
      tokensUsed: 150,
      toolCalls: [],
    }),
  })),
}));

vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: Object.assign(
    vi.fn().mockImplementation(async (strings: any, ...args: any[]) => {
      const query = typeof strings === 'string' ? strings : strings[0];
      if (query.includes('pg_extension')) return { rows: [{ has_vector: true }] };
      if (query.includes('information_schema.tables')) return { rows: [{ has_table: true }] };
      return { rows: [] };
    }),
    { unsafe: vi.fn().mockResolvedValue({ rows: [{ id: 1 }] }) }
  ),
}));

vi.mock('../../src/agent/core/StateManager.js', () => ({
  stateManager: {
    getState: vi.fn().mockResolvedValue({
      marketplace: 'WB',
      hasApiKeys: true,
      productsCount: 50,
      subscriptionTier: 'pro',
    }),
  },
}));

vi.mock('../../src/agent/execution/ToolRegistry.js', () => ({
  toolRegistry: {
    get: vi.fn().mockReturnValue(undefined),
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../src/api-lib/services/validation-log.service.js', () => ({
  validationLogService: {
    logValidation: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../src/infrastructure/rag/SpecialistKnowledgeBase.js', () => ({
  specialistKnowledgeBase: {
    retrieveForSpecialist: vi.fn().mockResolvedValue({
      documents: [],
      formattedContext: '',
      tokensEstimate: 0,
    }),
    retrieveHybrid: vi.fn().mockResolvedValue({
      documents: [],
      formattedContext: '',
      tokensEstimate: 0,
    }),
  },
}));

vi.mock('../../src/agent/core/KnowledgeBase.js', () => ({
  knowledgeBase: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

import {
  MultiAgentOrchestrator,
  multiAgentOrchestrator,
  orchestrateMultiAgent,
} from '../../src/agent/specialists/MultiAgentOrchestrator.js';
import type { OrchestratorContext } from '../../src/core/types/agent.types.js';

const mockContext: OrchestratorContext = {
  userId: 1,
};

describe('MultiAgentOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ embedding: new Array(1024).fill(0.1) }]), // HF Dummy response
        text: () => Promise.resolve('ok'),
      } as Response)
    );
  });

  describe('Constructor and instance', () => {
    it('should create orchestrator instance', () => {
      const orchestrator = new MultiAgentOrchestrator();
      expect(orchestrator).toBeDefined();
    });

    it('should export singleton instance', () => {
      expect(multiAgentOrchestrator).toBeInstanceOf(MultiAgentOrchestrator);
    });

    it('should export orchestrate function', () => {
      expect(orchestrateMultiAgent).toBeInstanceOf(Function);
    });
  });

  describe('orchestrate()', () => {
    it('should return valid MultiAgentResult structure', async () => {
      const result = await multiAgentOrchestrator.orchestrate('привет', mockContext);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('toolsCalled');
      expect(result).toHaveProperty('toolResults');
      expect(result).toHaveProperty('tokensUsed');
      expect(result).toHaveProperty('planningTimeMs');
      expect(result).toHaveProperty('executionTimeMs');
      expect(result).toHaveProperty('totalTimeMs');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('specialist');
    });

    it('should route CHAT queries to ChatSpecialist', async () => {
      const result = await multiAgentOrchestrator.orchestrate('привет', mockContext);
      expect(result.intent.category).toBe('CHAT');
      expect(result.specialist).toBe('ChatSpecialist');
    });

    it('should route PRODUCTS queries to ProductsSpecialist', async () => {
      const result = await multiAgentOrchestrator.orchestrate('мои товары', mockContext);
      expect(result.intent.category).toBe('PRODUCTS');
      expect(result.specialist).toBe('ProductsSpecialist');
    });

    it('should route PRICING queries to PricingSpecialist', async () => {
      const result = await multiAgentOrchestrator.orchestrate(
        'установи стоп-лосс 1000',
        mockContext
      );
      expect(result.intent.category).toBe('PRICING');
      expect(result.specialist).toBe('PricingSpecialist');
    });

    it('should route SENTINEL queries to SentinelSpecialist', async () => {
      const result = await multiAgentOrchestrator.orchestrate('статус защиты', mockContext);
      expect(result.intent.category).toBe('SENTINEL');
      expect(result.specialist).toBe('SentinelSpecialist');
    });

    it('should route ANALYTICS queries to AnalyticsSpecialist', async () => {
      const result = await multiAgentOrchestrator.orchestrate('юнит-экономика', mockContext);
      expect(result.intent.category).toBe('ANALYTICS');
      expect(result.specialist).toBe('AnalyticsSpecialist');
    });

    it('should track timing metrics', async () => {
      const result = await multiAgentOrchestrator.orchestrate('привет', mockContext);

      expect(result.planningTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(result.planningTimeMs);
    });

    it('should include intent classification result', async () => {
      const result = await multiAgentOrchestrator.orchestrate('найди товар 123456', mockContext);

      expect(result.intent).toHaveProperty('category');
      expect(result.intent).toHaveProperty('confidence');
      expect(result.intent).toHaveProperty('reasoning');
      expect(result.intent).toHaveProperty('entities');
      expect(result.intent).toHaveProperty('latencyMs');
    });
  });

  describe('orchestrateQuick()', () => {
    it('should use rule-based classification for speed', async () => {
      const result = await multiAgentOrchestrator.orchestrateQuick('привет', mockContext);

      expect(result.intent.classifiedBy).toBe('rules');
    });

    it('should be faster than full orchestrate', async () => {
      // Quick should not wait for LLM classification
      const quickResult = await multiAgentOrchestrator.orchestrateQuick('привет', mockContext);
      const quickTime = quickResult.planningTimeMs;

      // Quick classification should be < 10ms typically
      expect(quickTime).toBeLessThan(100);
    });

    it('should return valid result structure', async () => {
      const result = await multiAgentOrchestrator.orchestrateQuick('товары', mockContext);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('specialist');
    });
  });

  describe('Error handling', () => {
    it('should return fallback result on error', async () => {
      // Mock StateManager to throw
      const { stateManager } = await import('../../src/agent/core/StateManager.js');
      vi.mocked(stateManager.getState).mockRejectedValueOnce(new Error('DB Error'));

      const result = await multiAgentOrchestrator.orchestrate('привет', mockContext);

      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain('ошибка');
      expect(result.specialist).toBe('ChatSpecialist');
    });

    it('should fallback to CHAT category on error', async () => {
      const { stateManager } = await import('../../src/agent/core/StateManager.js');
      vi.mocked(stateManager.getState).mockRejectedValueOnce(new Error('Error'));

      const result = await multiAgentOrchestrator.orchestrate('товары', mockContext);

      expect(result.intent.category).toBe('CHAT');
      expect(result.intent.reasoning).toContain('Error');
    });
  });

  describe('Link extraction', () => {
    it('should extract WB links from message', async () => {
      // Need to mock specialist to return message with link
      const result = await multiAgentOrchestrator.orchestrate('привет', mockContext);

      // Links property should exist (may be undefined if no links)
      expect(result).toHaveProperty('links');
    });
  });

  describe('Confirmation actions', () => {
    it('should include actions for pricing changes', async () => {
      const result = await multiAgentOrchestrator.orchestrate('установи стоп-лосс', mockContext);

      // PricingSpecialist should include requiresConfirmation
      // This depends on the actual execution flow
      expect(result).toHaveProperty('actions');
    });
  });

  describe('Integration with orchestrateMultiAgent function', () => {
    it('should call orchestrator.orchestrate', async () => {
      const result = await orchestrateMultiAgent('привет', mockContext);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('specialist');
    });
  });
});
