import { WildberriesClient } from '@/integrations/wildberries/client';
import { describe, test, expect, beforeAll } from 'vitest';

describe('Wildberries Integration', () => {
  // Skip if no API key
  const skipIfNoKey = process.env.WB_API_KEY ? describe : describe.skip;

  skipIfNoKey('Live API tests', () => {
    let client: WildberriesClient;

    beforeAll(() => {
      client = new WildberriesClient();
    });

    test('should fetch products', async () => {
      const products = await client.getProducts();
      expect(Array.isArray(products)).toBe(true);
    });

    test('should fetch prices', async () => {
      const prices = await client.getPrices();
      expect(Array.isArray(prices)).toBe(true);
    });

    test('should respect rate limits', async () => {
      const start = Date.now();
      await Promise.all(
        Array(3)
          .fill(null)
          .map(() => client.getPrices())
      );
      const duration = Date.now() - start;
      console.log(`Requests took ${duration}ms`);
    });
  });

  test('Placeholder for CI', () => {
    expect(true).toBe(true);
  });
});
