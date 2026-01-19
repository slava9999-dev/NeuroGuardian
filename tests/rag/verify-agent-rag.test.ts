import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ProductsSpecialist } from '../../src/agent/specialists/ProductsSpecialist';
import { vectorStore } from '../../src/infrastructure/rag/VectorStore';

// Mock all external dependencies to avoid API calls and DB dependency
vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../src/infrastructure/rag/VectorStore', () => ({
  vectorStore: {
    hybridSearch: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ totalDocuments: 10 }),
    deleteDocuments: vi.fn(),
    dimensions: 1024,
  },
}));

describe('Agent RAG Integration Verification', () => {
  let specialist: ProductsSpecialist;

  beforeEach(() => {
    specialist = new ProductsSpecialist();
    vi.clearAllMocks();
  });

  it('should include RAG context when query is present', async () => {
    // 1. Setup Mock Data from VectorStore
    const mockSearchResults = [
      {
        id: 1,
        namespace: 'faq',
        title: 'Unit Economics Guide',
        content:
          'Unit economics is key to profitability. Calculate margin as (Price - Cost - Fees).',
        similarity: 0.9,
        vectorScore: 0.8,
        textScore: 0.5,
        combinedScore: 0.85,
        metadata: {},
      },
    ];

    (vectorStore.hybridSearch as Mock).mockResolvedValue(mockSearchResults);

    // 2. Execute Specialist Context Build
    const context = {
      userId: 123,
      userState: {
        marketplace: 'WB' as const,
        hasApiKeys: true,
        productsCount: 10,
        subscriptionTier: 'pro' as const,
      },
      query: 'how to calculate margin',
    };

    const contextStr = await specialist.buildContext(context);

    // 3. Verify RAG Call
    expect(vectorStore.hybridSearch).toHaveBeenCalledWith(
      'how to calculate margin',
      expect.objectContaining({
        namespace: ['wb_api', 'ozon_api', 'faq'],
        limit: 7,
        vectorWeight: 0.6,
      })
    );

    // 4. Verify Context Content
    expect(contextStr).toContain('## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
    expect(contextStr).toContain('Unit Economics Guide');
    expect(contextStr).toContain('(similarity: 90%)');
    expect(contextStr).toContain('Unit economics is key to profitability');

    console.log('✅ Agent successfully retrieved and formatted RAG context');
  });

  it('should handle empty RAG results gracefully', async () => {
    (vectorStore.hybridSearch as Mock).mockResolvedValue([]);

    const context = {
      userId: 123,
      userState: {
        marketplace: 'WB' as const,
        hasApiKeys: true,
        productsCount: 10,
        subscriptionTier: 'pro' as const,
      },
      query: 'unknown topic',
    };

    const contextStr = await specialist.buildContext(context);

    // Should NOT contain RAG section
    expect(contextStr).not.toContain('## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
    console.log('✅ Agent handled empty RAG results gracefully');
  });

  it('should handle VectorStore errors gracefully', async () => {
    (vectorStore.hybridSearch as Mock).mockRejectedValue(new Error('DB Connection Failed'));

    const context = {
      userId: 123,
      userState: {
        marketplace: 'WB' as const,
        hasApiKeys: true,
        productsCount: 10,
        subscriptionTier: 'pro' as const,
      },
      query: 'crash test',
    };

    // Should not throw
    const contextStr = await specialist.buildContext(context);

    expect(contextStr).toBeTruthy();
    expect(contextStr).not.toContain('## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
    console.log('✅ Agent handled RAG failure gracefully (Silent Fallback)');
  });
});
