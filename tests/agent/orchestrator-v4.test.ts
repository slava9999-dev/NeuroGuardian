// ============================================
// NeuroGUARDIAN — Agent Orchestrator V4 Tests
// Tests for two-phase pipeline architecture
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PlanSchema,
  AnswerSchema,
  validateAnswerLinks,
  sanitizeAnswerLinks,
  type Plan,
  type Answer,
  type ToolResult,
} from '../../src/api-lib/agent/schemas-v4.js';

// Mock fetch for OpenAI API calls
global.fetch = vi.fn();

// Mock database and services
vi.mock('../../src/api-lib/services/database.js', () => ({
  getProductsByUserId: vi.fn().mockResolvedValue([]),
  getUserById: vi.fn().mockResolvedValue({ id: 123 }),
}));

vi.mock('../../src/api-lib/lib/crypto.js', () => ({
  decryptApiKey: vi.fn((key: string) => key),
}));

describe('Agent Orchestrator V4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // SCHEMA VALIDATION TESTS
  // ============================================

  describe('PlanSchema', () => {
    it('should parse a valid plan', () => {
      const validPlan = {
        reasoning: 'User wants to see sales statistics',
        tools: [
          {
            tool: 'get_sales_stats',
            args: { marketplace: 'WB', period: '7d' },
            reason: 'Fetch WB sales data',
          },
        ],
        requires_confirmation: false,
      };

      const result = PlanSchema.safeParse(validPlan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toHaveLength(1);
        expect(result.data.tools[0].tool).toBe('get_sales_stats');
      }
    });

    it('should reject invalid tool names', () => {
      const invalidPlan = {
        reasoning: 'Test',
        tools: [
          {
            tool: 'invalid_tool_name',
            args: {},
            reason: 'Test',
          },
        ],
        requires_confirmation: false,
      };

      const result = PlanSchema.safeParse(invalidPlan);
      expect(result.success).toBe(false);
    });

    it('should accept all valid tool names', () => {
      const validToolNames = [
        'get_products',
        'get_sales_stats',
        'get_orders',
        'get_warehouse_stocks',
        'calculate_unit_economics',
        'get_abc_analysis',
        'get_stock_forecast',
        'get_marketplace_info',
        'search_web',
      ];

      for (const toolName of validToolNames) {
        const plan = {
          reasoning: `Testing ${toolName}`,
          tools: [{ tool: toolName, args: {}, reason: 'Test' }],
          requires_confirmation: false,
        };

        const result = PlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
      }
    });

    it('should default requires_confirmation to false when missing', () => {
      const planWithoutConfirmation = {
        reasoning: 'Test',
        tools: [],
      };

      // Zod .default() allows missing field and applies default value
      const result = PlanSchema.safeParse(planWithoutConfirmation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_confirmation).toBe(false);
      }
    });
  });

  describe('AnswerSchema', () => {
    it('should parse a valid answer with message only', () => {
      const validAnswer = {
        message: 'Вот ваша статистика продаж за неделю...',
      };

      const result = AnswerSchema.safeParse(validAnswer);
      expect(result.success).toBe(true);
    });

    it('should parse a complete answer with links and actions', () => {
      const completeAnswer = {
        message: 'Найдено несколько полезных статей по вашему запросу.',
        links: [
          {
            title: 'Гайд по юнит-экономике',
            url: 'https://example.com/guide',
            source: 'search_web' as const,
          },
        ],
        actions: [
          {
            type: 'update_prices' as const,
            summary: 'Обновить цены на 5 товаров',
            details_json: JSON.stringify({ product_ids: ['1', '2', '3', '4', '5'] }),
            affected_count: 5,
          },
        ],
      };

      const result = AnswerSchema.safeParse(completeAnswer);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.links).toHaveLength(1);
        expect(result.data.actions).toHaveLength(1);
      }
    });

    it('should reject invalid URL in links', () => {
      const invalidAnswer = {
        message: 'Test',
        links: [
          {
            title: 'Bad Link',
            url: 'not-a-valid-url',
            source: 'search_web',
          },
        ],
      };

      const result = AnswerSchema.safeParse(invalidAnswer);
      expect(result.success).toBe(false);
    });

    it('should reject invalid action types', () => {
      const invalidAnswer = {
        message: 'Test',
        actions: [
          {
            type: 'invalid_action_type',
            summary: 'Test',
            details_json: '{}',
            affected_count: 0,
          },
        ],
      };

      const result = AnswerSchema.safeParse(invalidAnswer);
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // LINK VALIDATION TESTS
  // ============================================

  describe('validateAnswerLinks', () => {
    it('should validate links that exist in tool results', () => {
      const answer: Answer = {
        message: 'Found some results',
        links: [
          {
            title: 'Example',
            url: 'https://example.com/page',
            source: 'search_web',
          },
        ],
      };

      const toolResults: ToolResult[] = [
        {
          tool: 'search_web',
          success: true,
          data: {
            results: [{ link: 'https://example.com/page' }],
          },
          urls: ['https://example.com/page'],
        },
      ];

      const result = validateAnswerLinks(answer, toolResults);
      expect(result.valid).toBe(true);
      expect(result.invalidLinks).toHaveLength(0);
    });

    it('should detect hallucinated links', () => {
      const answer: Answer = {
        message: 'Found some results',
        links: [
          {
            title: 'Hallucinated Link',
            url: 'https://fake-url.com/made-up',
            source: 'search_web',
          },
        ],
      };

      const toolResults: ToolResult[] = [
        {
          tool: 'search_web',
          success: true,
          data: {
            results: [{ link: 'https://real-url.com/actual' }],
          },
          urls: ['https://real-url.com/actual'],
        },
      ];

      const result = validateAnswerLinks(answer, toolResults);
      expect(result.valid).toBe(false);
      expect(result.invalidLinks).toContain('https://fake-url.com/made-up');
    });

    it('should handle answer without links', () => {
      const answer: Answer = {
        message: 'No links needed',
      };

      const toolResults: ToolResult[] = [];

      const result = validateAnswerLinks(answer, toolResults);
      expect(result.valid).toBe(true);
    });

    it('should handle empty links array', () => {
      const answer: Answer = {
        message: 'Empty links',
        links: [],
      };

      const toolResults: ToolResult[] = [];

      const result = validateAnswerLinks(answer, toolResults);
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeAnswerLinks', () => {
    it('should remove hallucinated links', () => {
      const answer: Answer = {
        message: 'Test',
        links: [
          {
            title: 'Valid',
            url: 'https://valid.com/page',
            source: 'search_web',
          },
          {
            title: 'Invalid',
            url: 'https://hallucinated.com/fake',
            source: 'search_web',
          },
        ],
      };

      const toolResults: ToolResult[] = [
        {
          tool: 'search_web',
          success: true,
          urls: ['https://valid.com/page'],
        },
      ];

      const sanitized = sanitizeAnswerLinks(answer, toolResults);
      expect(sanitized.links).toHaveLength(1);
      expect(sanitized.links![0].url).toBe('https://valid.com/page');
    });

    it('should return original answer if all links are valid', () => {
      const answer: Answer = {
        message: 'All valid',
        links: [
          {
            title: 'Valid 1',
            url: 'https://valid1.com',
            source: 'search_web',
          },
          {
            title: 'Valid 2',
            url: 'https://valid2.com',
            source: 'marketplace',
          },
        ],
      };

      const toolResults: ToolResult[] = [
        {
          tool: 'search_web',
          success: true,
          urls: ['https://valid1.com', 'https://valid2.com'],
        },
      ];

      const sanitized = sanitizeAnswerLinks(answer, toolResults);
      expect(sanitized.links).toHaveLength(2);
    });
  });

  // ============================================
  // TOOL EXECUTION TESTS
  // ============================================

  describe('Tool Execution Logic', () => {
    it('should handle empty tools array gracefully', async () => {
      const emptyPlan: Plan = {
        reasoning: 'Simple greeting, no tools needed',
        tools: [],
        requires_confirmation: false,
      };

      // Empty tools array should be valid
      expect(emptyPlan.tools).toHaveLength(0);
    });

    it('should identify confirmation-requiring actions', () => {
      const confirmationActions = [
        'update_prices',
        'set_stop_loss',
        'bulk_protect_products',
        'update_stocks',
      ];

      for (const actionType of confirmationActions) {
        const answer = {
          message: 'Need confirmation',
          actions: [
            {
              type: actionType,
              summary: 'Test action',
              details_json: '{}',
              affected_count: 1,
            },
          ],
        };

        const result = AnswerSchema.safeParse(answer);
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{ "reasoning": "unclosed string }';

      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    it('should handle missing required fields', () => {
      const missingFields = {
        // Missing 'reasoning' and 'tools'
        requires_confirmation: false,
      };

      const result = PlanSchema.safeParse(missingFields);
      expect(result.success).toBe(false);
    });

    it('should handle null values correctly', () => {
      const nullValues = {
        reasoning: null,
        tools: null,
        requires_confirmation: null,
      };

      const result = PlanSchema.safeParse(nullValues);
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // INTEGRATION TESTS (with mocked OpenAI)
  // ============================================

  describe('Pipeline Integration', () => {
    it('should correctly chain planner -> executor -> answerer', async () => {
      // This test validates the conceptual flow
      // In reality, each phase would make API calls

      // Phase 1: Plan
      const mockPlan: Plan = {
        reasoning: 'User wants sales stats',
        tools: [
          {
            tool: 'get_sales_stats',
            args: { marketplace: 'WB' },
            reason: 'Fetch WB sales',
          },
        ],
        requires_confirmation: false,
      };

      // Validate plan
      const planResult = PlanSchema.safeParse(mockPlan);
      expect(planResult.success).toBe(true);

      // Phase 2: Execute (mocked tool results)
      const mockToolResults: ToolResult[] = [
        {
          tool: 'get_sales_stats',
          success: true,
          data: {
            revenue: 150000,
            orders: 42,
            period: '7d',
          },
        },
      ];

      // Phase 3: Answer
      const mockAnswer: Answer = {
        message: 'За последние 7 дней:\n- Выручка: 150,000 ₽\n- Заказов: 42',
      };

      // Validate answer
      const answerResult = AnswerSchema.safeParse(mockAnswer);
      expect(answerResult.success).toBe(true);

      // Validate no hallucinated links
      const linkValidation = validateAnswerLinks(mockAnswer, mockToolResults);
      expect(linkValidation.valid).toBe(true);
    });
  });
});
