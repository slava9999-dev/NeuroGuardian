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

  /**
   * Universal fetch with retries for 429 (Rate Limit) and 5xx errors
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    backoff = 2000
  ): Promise<Response> {
    try {
      await this.rateLimiter.acquire();
      const response = await fetch(url, options);

      if (response?.status === 429 && retries > 0) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoff;

        console.warn(`[WildberriesClient] 429 Rate Limit hit. Retrying in ${waitTime}ms...`, {
          url,
          retriesRemaining: retries,
        });

        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }

      if (response?.status && response.status >= 500 && retries > 0) {
        console.warn(`[WildberriesClient] ${response.status} Server Error. Retrying...`, {
          url,
          retriesRemaining: retries,
        });
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }

      return response;
    } catch (error) {
      if (retries > 0) {
        console.warn('[WildberriesClient] Network error, retrying...', { error: String(error) });
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  }

  async getProducts(): Promise<WBProduct[]> {
    if (!this.config.apiKey) return [];
    try {
      const response = await this.fetchWithRetry(
        `${this.config.baseUrl}/content/v2/get/cards/list`,
        {
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
        }
      );

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
    const response = await this.fetchWithRetry(`${this.config.baseUrl}/public/api/v1/info`, {
      headers: { Authorization: this.config.apiKey },
    });

    if (!response || !response.ok) {
      throw new Error(`Failed to get prices: ${response?.status || 'Unknown error'}`);
    }

    return response.json();
  }

  async updatePrice(nmId: number, price: number): Promise<boolean> {
    if (!this.config.apiKey) return false;
    const response = await this.fetchWithRetry(`${this.config.baseUrl}/public/api/v1/prices`, {
      method: 'POST',
      headers: {
        Authorization: this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ nmId, price }]),
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
        const response = await this.fetchWithRetry(
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
