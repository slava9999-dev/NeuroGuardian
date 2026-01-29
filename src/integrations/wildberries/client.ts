import { RateLimiter } from '@/lib/rateLimiter';
import { fetchWithRetry } from '@/api-lib/lib/index.js';

interface WBConfig {
  apiKey: string;
  baseUrl: string;
}

interface WBProduct {
  nmID: number;
  vendorCode: string;
  title: string;
  stocks: Array<{ qty: number }>;
}

interface WBPrice {
  nmId: number;
  price: number;
}

export class WildberriesClient {
  private config: WBConfig;
  private rateLimiter: RateLimiter;

  constructor() {
    this.config = {
      apiKey: this.requireEnv('WB_API_KEY'),
      baseUrl: process.env.WB_API_URL || 'https://content-api.wildberries.ru',
    };

    // WB limits: ~100 requests per minute
    this.rateLimiter = new RateLimiter({
      maxRequests: 90,
      windowMs: 60000,
    });
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      // In non-production/test, allow missing keys to prevent build failures
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        console.warn(`[WildberriesClient] Missing ${key}, some features will fail`);
        return '';
      }
      throw new Error(`Missing required env variable: ${key}`);
    }
    return value;
  }

  async getProducts(): Promise<WBProduct[]> {
    if (!this.config.apiKey) return [];
    try {
      const response = await fetchWithRetry(`${this.config.baseUrl}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: {
          Authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            cursor: { limit: 100 },
            filter: { withPhoto: -1 },
          },
        }),
      });

      if (!response || !response.ok) {
        throw new Error(`Failed to get products: ${response?.status || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.cards || [];
    } catch (error) {
      console.error('WB getProducts error:', error);
      throw error;
    }
  }

  async getPrices(): Promise<WBPrice[]> {
    if (!this.config.apiKey) return [];
    // Modern Prices API - Requires limit/offset for v2
    const baseUrl = 'https://discounts-prices-api.wildberries.ru';
    const url = new URL(`${baseUrl}/api/v2/list/goods/filter`);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', '0');

    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: { Authorization: this.config.apiKey },
    });

    if (!response || !response.ok) {
      throw new Error(`Failed to get prices: ${response?.status || 'Unknown error'}`);
    }

    const data = await response.json();
    const goods = (data.data?.listGoods || []) as Array<{ nmID: number; price: number }>;
    return goods.map(g => ({
      nmId: g.nmID,
      price: g.price,
    }));
  }

  async updatePrice(nmId: number, price: number): Promise<boolean> {
    if (!this.config.apiKey) return false;
    const baseUrl = 'https://discounts-prices-api.wildberries.ru';
    const response = await fetchWithRetry(`${baseUrl}/api/v2/upload/task`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{ nmID: nmId, price, discount: 0 }],
      }),
    });

    if (!response || !response.ok) {
      const error = response ? await response.text() : 'Network error (fetch returned undefined)';
      throw new Error(`Failed to update price: ${error}`);
    }

    // Audit logging to be handled by service
    return true;
  }

  async getCompetitorPrices(nmIds: number[]): Promise<Map<number, number>> {
    const prices = new Map<number, number>();

    for (const nmId of nmIds) {
      try {
        const response = await fetchWithRetry(
          `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&nm=${nmId}`,
          {}
        );
        const data = await response.json();

        if (data.data?.products?.[0]?.salePriceU) {
          prices.set(nmId, data.data.products[0].salePriceU / 100);
        }
      } catch (error) {
        console.error(`Failed to get competitor price for ${nmId}:`, error);
      }
    }

    return prices;
  }
}
