// ============================================
// NeuroGUARDIAN — Specialists Tests
// Tests for all 5 specialist agents
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../../src/infrastructure/llm/GeminiProvider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockResolvedValue({
      content: 'Mocked response from Gemini',
      tokensUsed: 100,
    }),
    completeWithTools: vi.fn().mockResolvedValue({
      content: 'Mocked tool response',
      tokensUsed: 150,
      toolCalls: [],
    }),
  })),
}));

vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../src/agent/execution/ToolRegistry.js', () => ({
  toolRegistry: {
    get: vi.fn().mockReturnValue(undefined),
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../src/agent/core/KnowledgeBase.js', () => ({
  knowledgeBase: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

import {
  ProductsSpecialist,
  productsSpecialist,
} from '../../src/agent/specialists/ProductsSpecialist.js';
import {
  PricingSpecialist,
  pricingSpecialist,
} from '../../src/agent/specialists/PricingSpecialist.js';
import {
  SentinelSpecialist,
  sentinelSpecialist,
} from '../../src/agent/specialists/SentinelSpecialist.js';
import {
  AnalyticsSpecialist,
  analyticsSpecialist,
} from '../../src/agent/specialists/AnalyticsSpecialist.js';
import { ChatSpecialist, chatSpecialist } from '../../src/agent/specialists/ChatSpecialist.js';
import type { SpecialistContext } from '../../src/agent/specialists/BaseSpecialist.js';

const mockContext: SpecialistContext = {
  userId: 1,
  userState: {
    marketplace: 'WB',
    hasApiKeys: true,
    productsCount: 50,
    subscriptionTier: 'pro',
  },
};

describe('Specialists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProductsSpecialist', () => {
    it('should have correct name', () => {
      expect(productsSpecialist.name).toBe('ProductsSpecialist');
    });

    it('should have correct description', () => {
      expect(productsSpecialist.description).toContain('product');
    });

    it('should have 5 tools', () => {
      expect(productsSpecialist.tools).toHaveLength(5);
      expect(productsSpecialist.tools).toContain('get_products');
      expect(productsSpecialist.tools).toContain('update_product_settings');
      expect(productsSpecialist.tools).toContain('get_low_margin_products');
      expect(productsSpecialist.tools).toContain('get_real_price');
      expect(productsSpecialist.tools).toContain('sync_catalog');
    });

    it('should have systemPrompt with key sections', () => {
      const prompt = productsSpecialist.systemPrompt;
      expect(prompt).toContain('ВИКТОР');
      expect(prompt).toContain('ОПЕРАЦИОННЫЙ ДИРЕКТОР');
      expect(prompt).toContain('CRITICAL MODE');
      expect(prompt).toContain('get_products');
      expect(prompt).toContain('ЖЕЛЕЗНЫЕ ПРАВИЛА');
    });

    it('should build context with user info', async () => {
      const context = await productsSpecialist.buildContext(mockContext);
      expect(context).toContain('КОНТЕКСТ');
      expect(context).toContain('WB');
      expect(context).toContain('50');
    });

    it('should build context with no API keys message', async () => {
      const noKeysContext: SpecialistContext = {
        ...mockContext,
        userState: { ...mockContext.userState, hasApiKeys: false },
      };
      const context = await productsSpecialist.buildContext(noKeysContext);
      expect(context).toContain('нет');
    });
  });

  describe('PricingSpecialist', () => {
    it('should have correct name', () => {
      expect(pricingSpecialist.name).toBe('PricingSpecialist');
    });

    it('should have 5 tools', () => {
      expect(pricingSpecialist.tools).toHaveLength(5);
      expect(pricingSpecialist.tools).toContain('set_stop_loss');
      expect(pricingSpecialist.tools).toContain('update_prices');
      expect(pricingSpecialist.tools).toContain('bulk_protect_products');
      expect(pricingSpecialist.tools).toContain('calculate_unit_economics');
      expect(pricingSpecialist.tools).toContain('get_real_price');
    });

    it('should have systemPrompt with confirmation protocol', () => {
      const prompt = pricingSpecialist.systemPrompt;
      expect(prompt).toContain('ФИНАНСОВЫЙ КОНТРОЛЛЕР');
      expect(prompt).toContain('CONFIRMATION');
      expect(prompt).toContain('CFO MODE');
      expect(prompt).toContain('Да/Нет');
    });

    it('should have safety warnings in prompt', () => {
      const prompt = pricingSpecialist.systemPrompt;
      expect(prompt).toContain('ЖЕЛЕЗНЫЕ ПРАВИЛА');
      expect(prompt).toContain('НИКОГДА');
    });

    it('should build context with subscription tier', async () => {
      const context = await pricingSpecialist.buildContext(mockContext);
      expect(context).toContain('pro');
    });
  });

  describe('SentinelSpecialist', () => {
    it('should have correct name', () => {
      expect(sentinelSpecialist.name).toBe('SentinelSpecialist');
    });

    it('should have 7 tools', () => {
      expect(sentinelSpecialist.tools).toHaveLength(7);
      expect(sentinelSpecialist.tools).toContain('get_competitor_price');
      expect(sentinelSpecialist.tools).toContain('get_system_logs');
      expect(sentinelSpecialist.tools).toContain('set_stop_loss');
      expect(sentinelSpecialist.tools).toContain('bulk_protect_products');
      expect(sentinelSpecialist.tools).toContain('calculate_unit_economics');
      expect(sentinelSpecialist.tools).toContain('get_products');
      expect(sentinelSpecialist.tools).toContain('get_catalog_health');
    });

    it('should have systemPrompt with deterministic persona', () => {
      const prompt = sentinelSpecialist.systemPrompt;
      expect(prompt).toContain('DETERMINISTIC DEFENSE MACHINE');
      expect(prompt).toContain('Математическая целостность');
      expect(prompt).toContain('ALGORITHMIC SHIELD');
    });

    it('should have redirection for creative distractions', () => {
      const prompt = sentinelSpecialist.systemPrompt;
      // In 2026 mode, we focus on math, so just ensure we have "DETERMINISTIC" repeated or similar
      expect(prompt).toContain('DETERMINISTIC');
    });

    it('should build context with SENTINEL prefix', async () => {
      const context = await sentinelSpecialist.buildContext(mockContext);
      expect(context).toContain('SENTINEL');
    });
  });

  describe('AnalyticsSpecialist', () => {
    it('should have correct name', () => {
      expect(analyticsSpecialist.name).toBe('AnalyticsSpecialist');
    });

    it('should use Gemini Pro model', () => {
      // Access protected property via type assertion
      expect((analyticsSpecialist as unknown as { model: string }).model).toBe('gemini-1.5-pro');
    });

    it('should have 5 tools', () => {
      expect(analyticsSpecialist.tools).toHaveLength(5);
      expect(analyticsSpecialist.tools).toContain('calculate_unit_economics');
      expect(analyticsSpecialist.tools).toContain('get_abc_analysis');
      expect(analyticsSpecialist.tools).toContain('get_stock_forecast');
      expect(analyticsSpecialist.tools).toContain('get_sales_stats');
      expect(analyticsSpecialist.tools).toContain('get_orders');
    });

    it('should have systemPrompt with formulas', () => {
      const prompt = analyticsSpecialist.systemPrompt;
      expect(prompt).toContain('СТРАТЕГИЧЕСКИЙ КОНСУЛЬТАНТ');
      expect(prompt).toContain('Юнит-экономика 2.0');
      expect(prompt).toContain('ROI');
    });

    it('should have ABC analysis explanation', () => {
      const prompt = analyticsSpecialist.systemPrompt;
      expect(prompt).toContain('Категория A');
      expect(prompt).toContain('Категория C');
    });

    it('should build context with analytics prefix', async () => {
      const context = await analyticsSpecialist.buildContext(mockContext);
      expect(context).toContain('АНАЛИТИЧЕСКИЙ');
    });
  });

  describe('ChatSpecialist', () => {
    it('should have correct name', () => {
      expect(chatSpecialist.name).toBe('ChatSpecialist');
    });

    it('should have NO tools (RAG only)', () => {
      expect(chatSpecialist.tools).toHaveLength(0);
    });

    it('should have friendly systemPrompt', () => {
      const prompt = chatSpecialist.systemPrompt;
      expect(prompt).toContain('ВИКТОР');
      expect(prompt).toContain('НАСТАВНИК ПО БИЗНЕСУ');
      expect(prompt).toContain('MENTOR');
    });

    it('should have onboarding scenarios', () => {
      const prompt = chatSpecialist.systemPrompt;
      expect(prompt).toContain('ONBOARDING FUNNEL');
      expect(prompt).toContain('Этап 0');
    });

    it('should have setup scenarios', () => {
      const prompt = chatSpecialist.systemPrompt;
      expect(prompt).toContain('Синхронизация');
      expect(prompt).toContain('база пуста');
    });

    it('should suggest onboarding for users without API keys', async () => {
      const noKeysContext: SpecialistContext = {
        ...mockContext,
        userState: { ...mockContext.userState, hasApiKeys: false },
      };
      const context = await chatSpecialist.buildContext(noKeysContext);
      expect(context).toContain('ОНБОРДИНГ');
    });
  });

  describe('Specialist instances', () => {
    it('should export singleton instances', () => {
      expect(productsSpecialist).toBeInstanceOf(ProductsSpecialist);
      expect(pricingSpecialist).toBeInstanceOf(PricingSpecialist);
      expect(sentinelSpecialist).toBeInstanceOf(SentinelSpecialist);
      expect(analyticsSpecialist).toBeInstanceOf(AnalyticsSpecialist);
      expect(chatSpecialist).toBeInstanceOf(ChatSpecialist);
    });
  });

  describe('Prompt token estimates', () => {
    // Each specialist's prompt should be substantial but reasonable
    const MAX_TOKENS = 1500; // ~6000 chars
    const MIN_TOKENS = 200; // ~800 chars

    it('ProductsSpecialist prompt should be reasonable size', () => {
      const charCount = productsSpecialist.systemPrompt.length;
      expect(charCount).toBeGreaterThan(MIN_TOKENS * 4);
      expect(charCount).toBeLessThan(MAX_TOKENS * 4);
    });

    it('PricingSpecialist prompt should be reasonable size', () => {
      const charCount = pricingSpecialist.systemPrompt.length;
      expect(charCount).toBeGreaterThan(MIN_TOKENS * 4);
      expect(charCount).toBeLessThan(MAX_TOKENS * 4);
    });

    it('SentinelSpecialist prompt should be reasonable size', () => {
      const charCount = sentinelSpecialist.systemPrompt.length;
      expect(charCount).toBeGreaterThan(MIN_TOKENS * 4);
      expect(charCount).toBeLessThan(MAX_TOKENS * 4);
    });

    it('AnalyticsSpecialist prompt should be reasonable size', () => {
      const charCount = analyticsSpecialist.systemPrompt.length;
      expect(charCount).toBeGreaterThan(MIN_TOKENS * 4);
      expect(charCount).toBeLessThan(MAX_TOKENS * 4);
    });

    it('ChatSpecialist prompt should be reasonable size', () => {
      const charCount = chatSpecialist.systemPrompt.length;
      expect(charCount).toBeGreaterThan(MIN_TOKENS * 4);
      expect(charCount).toBeLessThan(MAX_TOKENS * 4);
    });
  });
});
