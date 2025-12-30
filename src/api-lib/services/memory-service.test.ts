import { describe, it, expect } from 'vitest';
import { memoryService } from './memory-service.js';

describe('MemoryService (ChromaDB)', () => {
  const testSessionId = 'test-session-123';

  it('should save and retrieve context from long-term memory', async () => {
    const testText = 'Пользователь предпочитает отчеты по понедельникам.';
    const metadata = { type: 'preference', priority: 'high' };

    // Сохраняем
    await memoryService.saveToLongTerm(testSessionId, testText, metadata);

    // Ищем
    const results = await memoryService.searchRelatedContext(
      testSessionId,
      'Как часто пользователь хочет отчеты?'
    );

    console.log('Search Results:', results);
    expect(results).toContain(testText);
  });

  it('should handle session history from short-term memory', async () => {
    const history = await memoryService.getSessionHistory(testSessionId);
    expect(Array.isArray(history)).toBe(true);
  });
});
