// ============================================
// NeuroGUARDIAN — MoE Router Tests
// Version: 2.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before imports
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockRejectedValue(new Error('LLM not available in test')),
  })),
}));

// Now import the module
import { classifyQuery, checkLocalLLMHealth } from '../../src/api-lib/agent/moe-router.js';

describe('MoE Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rule-based Classification', () => {
    it('should classify greeting as CHAT', async () => {
      const result = await classifyQuery('привет');

      expect(result.intent).toBe('CHAT');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.routeTo).toBe('local_chat');
      expect(result.classifiedBy).toBe('fallback_rules');
    });

    it('should classify "hello" as CHAT', async () => {
      const result = await classifyQuery('hello');

      expect(result.intent).toBe('CHAT');
      expect(result.routeTo).toBe('local_chat');
    });

    it('should classify price check query as STATS', async () => {
      const result = await classifyQuery('проверь цены на артикул 12345');

      expect(result.intent).toBe('STATS');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.routeTo).toBe('local_stats');
    });

    it('should classify stock query as STATS', async () => {
      const result = await classifyQuery('покажи остатки на складе');

      expect(result.intent).toBe('STATS');
      expect(result.routeTo).toBe('local_stats');
    });

    it('should classify WB price check as STATS', async () => {
      const result = await classifyQuery('WB цены');

      expect(result.intent).toBe('STATS');
      expect(result.routeTo).toBe('local_stats');
    });

    it('should classify analysis query as COMPLEX', async () => {
      const result = await classifyQuery('сделай анализ прибыльности товаров');

      expect(result.intent).toBe('COMPLEX');
      expect(result.routeTo).toBe('cloud_complex');
    });

    it('should classify strategy query as COMPLEX', async () => {
      const result = await classifyQuery('какую стратегию выбрать для продаж');

      expect(result.intent).toBe('COMPLEX');
      expect(result.routeTo).toBe('cloud_complex');
    });

    it('should classify ABC analysis as COMPLEX', async () => {
      const result = await classifyQuery('ABC анализ');

      expect(result.intent).toBe('COMPLEX');
      expect(result.routeTo).toBe('cloud_complex');
    });

    it('should default unknown queries to COMPLEX', async () => {
      const result = await classifyQuery('непонятный запрос без ключевых слов');

      expect(result.intent).toBe('COMPLEX');
      expect(result.routeTo).toBe('cloud_complex');
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });
  });

  describe('Routing Logic', () => {
    it('should always return valid RouteTarget', async () => {
      const queries = ['привет', 'цены на WB', 'сложный анализ конкурентов', 'random text'];

      for (const query of queries) {
        const result = await classifyQuery(query);
        expect(['local_stats', 'local_chat', 'cloud_complex']).toContain(result.routeTo);
      }
    });

    it('should return latency metric', async () => {
      const result = await classifyQuery('test query');

      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LLM Health Check', () => {
    it('should report unhealthy when LLM unavailable', async () => {
      const health = await checkLocalLLMHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
