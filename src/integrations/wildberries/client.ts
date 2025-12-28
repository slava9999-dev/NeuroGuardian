import { RateLimiter } from '@/lib/rateLimiter';

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
      baseUrl: process.env.WB_API_URL || 'https://suppliers-api.wildberries.ru',
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
    await this.rateLimiter.acquire();

    try {
      const response = await fetch(`${this.config.baseUrl}/content/v2/get/cards/list`, {
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

      if (!response.ok) {
        throw new Error(`Failed to get products: ${response.status}`);
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
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/public/api/v1/info`, {
      headers: { Authorization: this.config.apiKey },
    });

    if (!response.ok) {
      throw new Error(`Failed to get prices: ${response.status}`);
    }

    return response.json();
  }

  async updatePrice(nmId: number, price: number): Promise<boolean> {
    if (!this.config.apiKey) return false;
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/public/api/v1/prices`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ nmId, price }]),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update price: ${error}`);
    }

    // Audit logging to be handled by service
    return true;
  }

  async getCompetitorPrices(nmIds: number[]): Promise<Map<number, number>> {
    const prices = new Map<number, number>();

    for (const nmId of nmIds) {
      try {
        await this.rateLimiter.acquire();
        const response = await fetch(
          `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&nm=${nmId}`
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
