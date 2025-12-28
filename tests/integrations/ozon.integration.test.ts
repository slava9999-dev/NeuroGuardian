import { OzonClient } from '@/integrations/ozon/client';
import { describe, test, expect, beforeAll } from 'vitest';

describe('Ozon Integration', () => {
  const skipIfNoKey = process.env.OZON_API_KEY ? describe : describe.skip;

  skipIfNoKey('Live API tests', () => {
    let client: OzonClient;

    beforeAll(() => {
      client = new OzonClient();
    });

    test('should fetch products', async () => {
      const products = await client.getProducts();
      expect(Array.isArray(products)).toBe(true);
    });

    test('should fetch product info', async () => {
      const products = await client.getProducts(1, 5);
      if (products.length === 0) return;

      const productIds = products.map(p => p.product_id);
      const info = await client.getProductInfo(productIds);
      expect(info.length).toBeGreaterThan(0);
    });
  });

  test('Placeholder for CI', () => {
    expect(true).toBe(true);
  });
});
