import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetReviews } from '../../src/api-lib/agent/tool-executors.js';
import * as reviewService from '../../src/api-lib/services/reviews-service.js';

// Mock the service
vi.mock('../../src/api-lib/services/reviews-service.js', () => ({
  getUserReviews: vi.fn(),
}));

// Mock Security Agent as it is imported in tool-executors
vi.mock('@neuroguardian/security-agent', () => ({
  getSecurityAgent: () => ({
    isInitialized: () => true,
    secrets: {
      get: vi.fn().mockResolvedValue({ value: 'mock-key' }),
    },
  }),
}));

// Mock other services imported in tool-executors to avoid side effects
vi.mock('../../src/api-lib/services/index.js', () => ({
  paymentApi: {},
  getPrices: vi.fn(),
  getStocks: vi.fn(),
  getSalesStats: vi.fn(),
  getOrders: vi.fn(),
  fetchOzonStocksV3: vi.fn(),
  getSystemEvents: vi.fn(),
}));

// Type for mock reviews matching the service output
interface MockReview {
  id: string;
  marketplace: 'WB' | 'Ozon';
  rating: number;
  text: string;
  author_name: string;
  created_at: string;
  status: 'new' | 'viewed' | 'replied';
  product_title: string;
  product_id: string;
}

// Type for the tool result data
interface ReviewsResultData {
  total?: number;
  reviews: Array<{ author: string; rating: number; text: string }>;
  message?: string;
}

describe('Review Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeGetReviews should return formatted reviews', async () => {
    // Setup mock data
    const mockReviews: MockReview[] = [
      {
        id: '1',
        marketplace: 'WB',
        rating: 5,
        text: 'Отличный товар, рекомендую!',
        author_name: 'Иван',
        created_at: '2024-01-01T12:00:00Z',
        status: 'new',
        product_title: 'Супер Товар',
        product_id: '123',
      },
      {
        id: '2',
        marketplace: 'Ozon',
        rating: 1,
        text: 'Ужасное качество.',
        author_name: 'Петр',
        created_at: '2024-01-02T12:00:00Z',
        status: 'viewed',
        product_title: 'Плохой Товар',
        product_id: '456',
      },
    ];

    // Note: Mock returns all reviews regardless of marketplace filter
    // The actual service would filter, but we're testing the executor's data transformation
    vi.mocked(reviewService.getUserReviews).mockResolvedValue(mockReviews);

    // Call the tool with WB filter
    const result = await executeGetReviews(1, { limit: 10, marketplace: 'WB' });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Check specific fields
    const data = result.data as ReviewsResultData;
    expect(data.total).toBe(2);
    expect(data.reviews).toHaveLength(2);
    expect(data.reviews[0].author).toBe('Иван');
    expect(data.reviews[0].rating).toBe(5);
    expect(data.reviews[0].text).toContain('Отличный товар');

    // Verify service call
    expect(reviewService.getUserReviews).toHaveBeenCalledWith(1, { limit: 10, marketplace: 'WB' });
  });

  it('executeGetReviews should handle empty results gracefully', async () => {
    vi.mocked(reviewService.getUserReviews).mockResolvedValue([]);

    const result = await executeGetReviews(1, { limit: 5 });

    expect(result.success).toBe(true);
    const data = result.data as ReviewsResultData;
    expect(data.reviews).toEqual([]);
    expect(data.message).toContain('не найдено');
  });

  it('executeGetReviews should fail on validation error', async () => {
    // Limit too high (max 50)
    const result = await executeGetReviews(1, { limit: 1000 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('limit');
  });
});
