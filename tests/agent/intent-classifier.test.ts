// ============================================
// NeuroGUARDIAN — IntentClassifier Tests
// Tests for the 5-category intent classifier
// Version: 1.0.0 | Date: January 2026
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock GeminiProvider before importing classifier
vi.mock('../../src/infrastructure/llm/GeminiProvider.js', () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockResolvedValue({
      content: '{"category": "CHAT", "confidence": 0.9, "reasoning": "test", "entities": {}}',
      tokensUsed: 100,
    }),
  })),
}));

import {
  classifyIntent,
  classifyIntentSync,
} from '../../src/agent/specialists/IntentClassifier.js';
import type { IntentCategory } from '../../src/agent/specialists/IntentClassifier.js';

describe('IntentClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyIntentSync (Rule-based)', () => {
    describe('CHAT category', () => {
      const chatQueries = [
        'привет',
        'здравствуйте',
        'хай',
        'hello',
        'добрый день',
        'что ты умеешь',
        'помощь',
        'как работает система',
        'спасибо',
        'как подключить API',
        'инструкция',
        'подписка',
        'сколько стоит',
      ];

      it.each(chatQueries)('should classify "%s" as CHAT', query => {
        const result = classifyIntentSync(query);
        expect(result.category).toBe('CHAT');
        expect(result.confidence).toBeGreaterThanOrEqual(0.5);
        expect(result.classifiedBy).toBe('rules');
      });
    });

    describe('PRODUCTS category', () => {
      const productQueries = [
        'мои товары',
        'покажи мои товары', // Fixed: needs "мои" or similar before "товары"
        'найди товар кроссовки',
        'артикул 123456789',
        'товары на WB',
        'синхронизируй товары',
        'сколько у меня товаров',
        'товары с низкой маржой', // Different phrasing
        'реальная цена товара',
      ];

      it.each(productQueries)('should classify "%s" as PRODUCTS', query => {
        const result = classifyIntentSync(query);
        expect(result.category).toBe('PRODUCTS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe('PRICING category', () => {
      const pricingQueries = [
        'установи стоп-лосс 1000',
        'стоплосс 500 рублей',
        'измени цену на 2000',
        'защити все товары',
        'минимальная цена 800',
        'включи защиту',
        'активируй Sentinel',
        'установи порог цены',
      ];

      it.each(pricingQueries)('should classify "%s" as PRICING', query => {
        const result = classifyIntentSync(query);
        expect(result.category).toBe('PRICING');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe('SENTINEL category', () => {
      const sentinelQueries = [
        'статус защиты',
        'какие угрозы',
        'конкуренты',
        'цены конкурентов',
        'Sentinel статус',
        'мониторинг цен',
        'история защиты',
        'логи Sentinel',
        'анализ конкурентов',
      ];

      it.each(sentinelQueries)('should classify "%s" as SENTINEL', query => {
        const result = classifyIntentSync(query);
        expect(result.category).toBe('SENTINEL');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe('ANALYTICS category', () => {
      const analyticsQueries = [
        'юнит-экономика',
        'ABC анализ',
        'прогноз продаж',
        'статистика за месяц',
        'сколько заработал',
        'рентабельность',
        'маржа товара',
        'себестоимость',
        'посчитай прибыль',
        'какой доход',
      ];

      it.each(analyticsQueries)('should classify "%s" as ANALYTICS', query => {
        const result = classifyIntentSync(query);
        expect(result.category).toBe('ANALYTICS');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      });
    });

    describe('Entity extraction', () => {
      it('should extract product IDs (5+ digit numbers)', () => {
        const result = classifyIntentSync('найди товар 123456789');
        expect(result.entities.productIds).toContain('123456789');
      });

      it('should extract multiple product IDs', () => {
        const result = classifyIntentSync('сравни 12345 и 67890');
        expect(result.entities.productIds).toHaveLength(2);
      });

      it('should extract prices with ₽ symbol', () => {
        const result = classifyIntentSync('установи цену 1500₽');
        expect(result.entities.prices).toContain(1500);
      });

      it('should extract prices with "рублей"', () => {
        const result = classifyIntentSync('минимум 2000 рублей');
        expect(result.entities.prices).toContain(2000);
      });

      it('should detect WB marketplace', () => {
        const result = classifyIntentSync('товары на WB');
        expect(result.entities.marketplace).toBe('WB');
      });

      it('should detect Wildberries marketplace', () => {
        const result = classifyIntentSync('товары wildberries');
        expect(result.entities.marketplace).toBe('WB');
      });

      it('should detect Ozon marketplace', () => {
        const result = classifyIntentSync('товары на Ozon');
        expect(result.entities.marketplace).toBe('Ozon');
      });

      it('should detect Озон (cyrillic) marketplace', () => {
        const result = classifyIntentSync('товары на озон');
        expect(result.entities.marketplace).toBe('Ozon');
      });
    });

    describe('Default fallback', () => {
      it('should default to CHAT for unknown queries', () => {
        const result = classifyIntentSync('абракадабра непонятный текст');
        expect(result.category).toBe('CHAT');
        expect(result.confidence).toBe(0.5);
        expect(result.reasoning).toContain('no pattern matched');
      });
    });

    describe('Latency tracking', () => {
      it('should track latency', () => {
        const result = classifyIntentSync('привет');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        expect(result.latencyMs).toBeLessThan(100); // Rules should be fast
      });
    });
  });

  describe('classifyIntent (Async with LLM fallback)', () => {
    it('should return valid classification result', async () => {
      const result = await classifyIntent('привет');

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('latencyMs');
      expect(result).toHaveProperty('classifiedBy');
    });

    it('should use rules when no API key', async () => {
      // Without GEMINI_API_KEY, should fallback to rules
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const result = await classifyIntent('привет');
      expect(result.classifiedBy).toBe('rules');

      // Restore
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    });
  });

  describe('Category type safety', () => {
    it('should return valid IntentCategory type', () => {
      const validCategories: IntentCategory[] = [
        'PRODUCTS',
        'PRICING',
        'SENTINEL',
        'ANALYTICS',
        'CHAT',
      ];

      const result = classifyIntentSync('привет');
      expect(validCategories).toContain(result.category);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = classifyIntentSync('');
      expect(result.category).toBe('CHAT'); // Default fallback
    });

    it('should handle very long query', () => {
      const longQuery = 'привет '.repeat(1000);
      const result = classifyIntentSync(longQuery);
      expect(result).toBeDefined();
      expect(result.category).toBe('CHAT');
    });

    it('should handle special characters', () => {
      const result = classifyIntentSync('!@#$%^&*()');
      expect(result).toBeDefined();
      expect(result.category).toBe('CHAT');
    });

    it('should be case insensitive', () => {
      const lower = classifyIntentSync('привет');
      const upper = classifyIntentSync('ПРИВЕТ');
      expect(lower.category).toBe(upper.category);
    });

    it('should handle mixed language queries', () => {
      const result = classifyIntentSync('help помощь');
      expect(result.category).toBe('CHAT');
    });
  });
});
