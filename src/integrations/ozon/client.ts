import { RateLimiter } from '@/lib/rateLimiter';

interface OzonConfig {
  clientId: string;
  apiKey: string;
  baseUrl: string;
}

export interface OzonProduct {
  product_id: number;
  offer_id: string;
}

interface OzonProductInfo {
  id: number;
  name: string;
  stocks: { present: number };
}

interface OzonPrice {
  product_id: number;
  price: {
    price: string;
    old_price: string;
  };
}

export interface OzonPriceUpdate {
  product_id: number;
  price: string;
  old_price?: string;
  min_price?: string;
}

export class OzonClient {
  private config: OzonConfig;
  private rateLimiter: RateLimiter;

  constructor() {
    this.config = {
      clientId: this.requireEnv('OZON_CLIENT_ID'),
      apiKey: this.requireEnv('OZON_API_KEY'),
      baseUrl: process.env.OZON_API_URL || 'https://api-seller.ozon.ru',
    };

    this.rateLimiter = new RateLimiter({
      maxRequests: 50,
      windowMs: 60000,
    });
  }

  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        console.warn(`[OzonClient] Missing ${key}, some features will fail`);
        return '';
      }
      throw new Error(`Missing required env variable: ${key}`);
    }
    return value;
  }

  private getHeaders(): HeadersInit {
    return {
      'Client-Id': this.config.clientId,
      'Api-Key': this.config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async getProducts(page: number = 1, pageSize: number = 100): Promise<OzonProduct[]> {
    if (!this.config.apiKey) return [];
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/v2/product/list`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        page,
        page_size: pageSize,
      }),
    });

    if (!response || !response.ok) {
      throw new Error(`Failed to get products: ${response?.status || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.result.items || [];
  }

  async getProductInfo(productIds: number[]): Promise<OzonProductInfo[]> {
    if (productIds.length === 0 || !this.config.apiKey) return [];
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/v2/product/info/list`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        product_id: productIds,
      }),
    });

    if (!response || !response.ok) {
      throw new Error(`Failed to get product info: ${response?.status || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.result.items || [];
  }

  async getPrices(productIds: number[]): Promise<OzonPrice[]> {
    if (productIds.length === 0 || !this.config.apiKey) return [];
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/v4/product/info/prices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        filter: { product_id: productIds },
        limit: 100,
      }),
    });

    if (!response || !response.ok) {
      throw new Error(`Failed to get prices: ${response?.status || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.result.items || [];
  }

  async updatePrices(updates: OzonPriceUpdate[]): Promise<Record<string, unknown>> {
    if (!this.config.apiKey) return {};
    await this.rateLimiter.acquire();

    const response = await fetch(`${this.config.baseUrl}/v1/product/import/prices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prices: updates }),
    });

    if (!response || !response.ok) {
      const error = response ? await response.text() : 'Network error (fetch returned undefined)';
      throw new Error(`Failed to update prices: ${error}`);
    }

    const result = await response.json();
    return result.result;
  }
}
