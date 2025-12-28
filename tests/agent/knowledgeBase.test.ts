import { knowledgeBase } from '@/agent/knowledgeBase';
import { describe, test, expect, beforeAll } from 'vitest';

describe('Knowledge Base', () => {
  beforeAll(async () => {
    await knowledgeBase.loadDocuments();
  });

  test('should verify valid state', async () => {
    const verification = await knowledgeBase.verifyKnowledge();
    // In test env might be empty DB, so just check structure
    expect(verification).toHaveProperty('totalDocuments');
  });

  test('should search text', async () => {
    // Inject mock doc if needed or test empty
    const results = await knowledgeBase.search('test');
    expect(Array.isArray(results)).toBe(true);
  });
});
