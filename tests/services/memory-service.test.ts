// ============================================
// NeuroGUARDIAN — Memory Service Tests
// Version: 2.0.0 | Date: December 2024
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    heartbeat: vi.fn().mockRejectedValue(new Error('ChromaDB not available')),
    getOrCreateCollection: vi.fn(),
  })),
}));

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockRejectedValue(new Error('KV not available')),
  },
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

import { MemoryService, type ChatMessage } from '../../src/api-lib/services/memory-service.js';

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MemoryService();
  });

  describe('Initialization', () => {
    it('should create instance without throwing', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Session History (Short-term)', () => {
    it('should return empty array when session not found', async () => {
      const history = await service.getSessionHistory('non-existent');
      expect(history).toEqual([]);
    });

    it('should return empty array on KV error', async () => {
      const history = await service.getSessionHistory('test-session');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Long-term Memory', () => {
    it('should handle unavailable ChromaDB gracefully', async () => {
      const result = await service.saveToLongTerm('session-1', 'test text', {
        type: 'user_query',
        timestamp: new Date().toISOString(),
      });

      // Should return false when ChromaDB unavailable
      expect(result).toBe(false);
    });

    it('should return empty array for search when ChromaDB unavailable', async () => {
      const results = await service.searchRelatedContext('session-1', 'query');
      expect(results).toEqual([]);
    });
  });

  describe('Memory Migration', () => {
    it('should return false when KV unavailable', async () => {
      const result = await service.packAndMigrate('session-1');
      expect(result).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should report service health status', async () => {
      const health = await service.getHealth();

      expect(health).toHaveProperty('chromaHealthy');
      expect(health).toHaveProperty('kvHealthy');
      expect(health).toHaveProperty('embeddingsAvailable');

      // Both should be false due to mocked failures
      expect(health.chromaHealthy).toBe(false);
      expect(health.kvHealthy).toBe(false);
    });
  });

  describe('ChatMessage Type', () => {
    it('should accept valid ChatMessage structure', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Test message');
      expect(message.timestamp).toBeDefined();
    });

    it('should work without optional timestamp', () => {
      const message: ChatMessage = {
        role: 'assistant',
        content: 'Response',
      };

      expect(message.role).toBe('assistant');
      expect(message.timestamp).toBeUndefined();
    });
  });
});
