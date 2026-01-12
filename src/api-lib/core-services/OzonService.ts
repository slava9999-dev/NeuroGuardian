import { fetchWithRetry } from '../lib/index.js';
import type {
  OzonProductInfo,
  OzonStockItem,
  OzonPriceUpdateResult,
  OzonError,
  OzonOrder,
  OzonStockV3Item,
  OzonAnalyticsRow,
} from '../lib/marketplace-types.js';
import type { MarketplaceProduct, MarketplaceSalesStats } from './MarketplaceTypes.js';

export class OzonService {
  private readonly PRICE_API_URL = 'https://api-seller.ozon.ru/v1/product/import/prices';
  private readonly PRODUCT_LIST_API = 'https://api-seller.ozon.ru/v3/product/list';
  private readonly PRODUCT_INFO_API = 'https://api-seller.ozon.ru/v3/product/info/list';
  private readonly ANALYTICS_API = 'https://api-seller.ozon.ru/v1/analytics/data';
  private readonly PRICE_INFO_API = 'https://api-seller.ozon.ru/v1/product/info/prices';
  private readonly STOCK_UPDATE_API = 'https://api-seller.ozon.ru/v1/product/import/stocks'; // v1/product/import/stocks for zeroing, v2/products/stocks for updates

  /**
   * Fetch products from Ozon API
   */
  async fetchProducts(
    clientId: string,
    apiKey: string,
    limit = 100
  ): Promise<MarketplaceProduct[]> {
    // Step 1: Get product list
    const listResponse = await fetch(this.PRODUCT_LIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ filter: {}, last_id: '', limit }),
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      throw new Error(`Ozon API error: ${listResponse.status} - ${errorText}`);
    }

    const listData = await listResponse.json();
    const items = listData.result?.items || [];

    if (items.length === 0) return [];

    // Step 2: Get product details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productIds = items.map((item: any) => item.product_id);
    const detailResponse = await fetch(this.PRODUCT_INFO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ product_id: productIds }),
    });

    if (!detailResponse.ok) {
      throw new Error(`Ozon Product Info API error: ${detailResponse.status}`);
    }

    const detailData = await detailResponse.json();
    const detailItems: OzonProductInfo[] = detailData.result?.items || detailData.items || [];

    // Step 3: Map to unified format
    return detailItems.map(item => {
      const stocks: OzonStockItem[] = item.stocks?.stocks || [];
      const totalStock = stocks.reduce((acc, s) => acc + (s.present || 0), 0);

      let price = 0;
      if (typeof item.price === 'object' && item.price !== null) {
        price = parseFloat(item.price.marketing_price || item.price.price || '0');
      } else if (typeof item.price === 'string') {
        price = parseFloat(item.price || item.marketing_price || '0');
      }

      return {
        product_id: `ozon-${item.id}`,
        title: item.name || 'Без названия',
        image_url:
          (typeof item.primary_image === 'string'
            ? item.primary_image
            : (item.primary_image as string[])?.[0]) ||
          item.images?.[0] ||
          null,
        current_price: Math.round(price),
        current_stock: totalStock,
        marketplace: 'Ozon' as const,
      };
    });
  }

  /**
   * Update prices on Ozon
   */
  async updatePrices(
    clientId: string,
    apiKey: string,
    updates: Array<{ productId: number; price: number }>
  ): Promise<{ success: boolean; count: number; error?: string; partialErrors?: string[] }> {
    if (updates.length === 0) {
      return { success: true, count: 0 };
    }

    const validUpdates = updates.filter(
      u =>
        Number.isFinite(u.productId) && u.productId > 0 && Number.isFinite(u.price) && u.price > 0
    );

    if (validUpdates.length === 0) {
      return { success: false, count: 0, error: 'No valid updates' };
    }

    try {
      const payload = {
        prices: validUpdates.map(u => ({
          product_id: u.productId,
          price: String(u.price),
          old_price: String(Math.round(u.price * 1.1)),
          currency_code: 'RUB',
        })),
      };

      const response = await fetchWithRetry(this.PRICE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseData = await response.json();
        const results: OzonPriceUpdateResult[] = responseData.result || [];
        const successfulUpdates = results.filter(r => r.updated === true);
        const failedUpdates = results.filter(
          r => r.updated === false || (r.errors && r.errors.length > 0)
        );

        if (failedUpdates.length > 0) {
          const errorMessages = failedUpdates
            .flatMap(
              f =>
                f.errors?.map(
                  (e: OzonError) => `product_id ${f.product_id}: ${e.message || e.code}`
                ) || [`product_id ${f.product_id}: update failed`]
            )
            .slice(0, 5);

          if (successfulUpdates.length > 0) {
            return {
              success: true,
              count: successfulUpdates.length,
              error: `${failedUpdates.length} of ${validUpdates.length} items failed`,
              partialErrors: errorMessages,
            };
          } else {
            return {
              success: false,
              count: 0,
              error: `All ${failedUpdates.length} items failed: ${errorMessages.join('; ')}`,
              partialErrors: errorMessages,
            };
          }
        }

        return { success: true, count: validUpdates.length };
      } else {
        const errorText = await response.text();
        return { success: false, count: 0, error: errorText };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, count: 0, error };
    }
  }

  /**
   * Get sales stats from Ozon
   */
  async fetchSalesStats(
    clientId: string,
    apiKey: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<MarketplaceSalesStats | null> {
    try {
      const response = await fetchWithRetry(this.ANALYTICS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({
          date_from: dateFrom.toISOString().split('T')[0],
          date_to: dateTo.toISOString().split('T')[0],
          metrics: ['revenue', 'ordered_units', 'returns'],
          dimension: ['day'],
          limit: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.result?.data || [];

        let revenue = 0,
          orders = 0,
          returns = 0;

        for (const row of result) {
          revenue += row.metrics?.[0] || 0;
          orders += row.metrics?.[1] || 0;
          returns += row.metrics?.[2] || 0;
        }

        return {
          period: 'custom',
          dateFrom: dateFrom.toISOString().split('T')[0],
          dateTo: dateTo.toISOString().split('T')[0],
          orders,
          revenue: Math.round(revenue),
          returns,
        };
      }
    } catch (e) {
      console.error('Ozon stats error:', e);
    }
    return null;
  }

  /**
   * Fetch current prices from Ozon for price monitoring
   */
  async fetchCurrentPrices(
    clientId: string,
    apiKey: string,
    productIds: number[]
  ): Promise<Map<number, number>> {
    const priceMap = new Map<number, number>();

    if (productIds.length === 0) return priceMap;

    try {
      const response = await fetchWithRetry(this.PRICE_INFO_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({
          product_id: productIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const items = data.result?.items || data.items || [];

        for (const p of items) {
          const actualPrice = parseFloat(p.marketing_price || p.price || '0');
          if (p.product_id && actualPrice > 0) {
            priceMap.set(p.product_id, Math.round(actualPrice));
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch Ozon prices:', e);
    }

    return priceMap;
  }

  /**
   * Set Ozon product stock to zero (defense action)
   */
  async setZeroStock(
    clientId: string,
    apiKey: string,
    products: Array<{ productId: number; offerId: string }>
  ): Promise<{ success: boolean; error?: string }> {
    if (products.length === 0) return { success: true };

    try {
      const payload = {
        stocks: products.map(p => ({
          offer_id: p.offerId,
          product_id: p.productId,
          stock: 0,
        })),
      };

      const response = await fetchWithRetry(this.STOCK_UPDATE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Set Ozon product price (defense action - price correction)
   */
  async setDefensePrice(
    clientId: string,
    apiKey: string,
    products: Array<{ productId: number; offerId: string; price: number }>
  ): Promise<{ success: boolean; error?: string }> {
    if (products.length === 0) return { success: true };

    try {
      const payload = {
        prices: products.map(p => ({
          offer_id: p.offerId,
          product_id: p.productId,
          price: String(p.price),
          old_price: String(Math.round(p.price * 1.2)),
          min_price: String(p.price),
          currency_code: 'RUB',
        })),
      };

      const response = await fetchWithRetry(this.PRICE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true };
      } else {
        const errorText = await response.text();
        return { success: false, error: errorText };
      }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Update Ozon stock for FBS products
   */
  async updateStockFbs(
    clientId: string,
    apiKey: string,
    updates: Array<{ productId: number; offerId: string; stock: number; warehouseId?: number }>
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (updates.length === 0) return { success: true, count: 0 };

    const validUpdates = updates.filter(
      u => u.productId > 0 && Number.isFinite(u.stock) && u.stock >= 0
    );
    if (validUpdates.length === 0) return { success: false, count: 0, error: 'No valid updates' };

    try {
      const payload = {
        stocks: validUpdates.map(u => ({
          offer_id: u.offerId,
          product_id: u.productId,
          stock: u.stock,
          ...(u.warehouseId && { warehouse_id: u.warehouseId }),
        })),
      };

      const response = await fetchWithRetry('https://api-seller.ozon.ru/v2/products/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseData = await response.json();
        const results = responseData.result || [];

        const failedItems = results.filter(
          (r: OzonPriceUpdateResult) => r.updated === false || (r.errors && r.errors.length > 0)
        );

        if (failedItems.length > 0) {
          if (failedItems.length === validUpdates.length)
            return { success: false, count: 0, error: 'All updates failed' };
          return {
            success: true,
            count: validUpdates.length - failedItems.length,
            error: `Partial failure: ${failedItems.length} errors`,
          };
        }

        return { success: true, count: validUpdates.length };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, count: 0, error: errorData.message || `HTTP ${response.status}` };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, count: 0, error };
    }
  }

  /**
   * Get Ozon FBS warehouses
   */
  async getFbsWarehouses(
    clientId: string,
    apiKey: string
  ): Promise<{ warehouses: Array<{ id: number; name: string }>; error?: string }> {
    try {
      const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/warehouse/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        const data = await response.json();

        const warehouses = (data.result || []).map(
          (w: { warehouse_id: number; name?: string }) => ({
            id: w.warehouse_id,
            name: w.name || `Склад ${w.warehouse_id}`,
          })
        );
        return { warehouses };
      } else {
        const errorText = await response.text();
        return { warehouses: [], error: errorText };
      }
    } catch (e) {
      return { warehouses: [], error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }
  /**
   * Fetch raw Ozon FBS UNFULFILLED orders
   */
  async fetchUnfulfilledOrders(clientId: string, apiKey: string): Promise<OzonOrder[]> {
    try {
      const response = await fetchWithRetry(
        'https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Id': clientId,
            'Api-Key': apiKey,
          },
          body: JSON.stringify({
            dir: 'ASC',
            filter: {
              cutoff_from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              cutoff_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            limit: 100,
            with: { analytics_data: true, financial_data: true },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        const result = data as { result: { postings: OzonOrder[] } };
        return result.result?.postings || [];
      }
    } catch (e) {
      console.error('Ozon unfulfilled error:', e);
    }
    return [];
  }

  /**
   * Fetch Ozon stocks using v3 API
   */
  async fetchStocks(clientId: string, apiKey: string, limit = 100): Promise<OzonStockV3Item[]> {
    try {
      const response = await fetchWithRetry('https://api-seller.ozon.ru/v3/product/info/stocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({
          filter: { visibility: 'ALL' },
          limit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data as { result: { items: OzonStockV3Item[] } };
        return result.result?.items || [];
      }
    } catch (e) {
      console.error('Ozon V3 stocks error:', e);
    }
    return [];
  }

  /**
   * Fetch Ozon analytics data
   */
  async fetchAnalytics(
    clientId: string,
    apiKey: string,
    dateFrom: string,
    dateTo: string,
    metrics: string[] = ['revenue', 'ordered_units', 'returns']
  ): Promise<OzonAnalyticsRow[]> {
    try {
      const response = await fetchWithRetry(this.ANALYTICS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({
          date_from: dateFrom,
          date_to: dateTo,
          metrics,
          dimension: ['day'],
          limit: 1000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data as { result: { data: OzonAnalyticsRow[] } };
        return result.result?.data || [];
      }
    } catch (e) {
      console.error('Ozon analytics error:', e);
    }
    return [];
  }

  /**
   * Fetch Ozon Product Info (v2)
   */
  async fetchProductInfo(
    clientId: string,
    apiKey: string,
    productIds: string[]
  ): Promise<OzonProductInfo[]> {
    try {
      const response = await fetchWithRetry('https://api-seller.ozon.ru/v2/product/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify({ product_id: productIds }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data as { result: { items: OzonProductInfo[] } };
        return result.result?.items || [];
      }
    } catch (e) {
      console.error('Ozon Product Info error:', e);
    }
    return [];
  }

  /**
   * Fetch raw Ozon orders (FBO + FBS)
   */
  async fetchOrders(clientId: string, apiKey: string, dateFrom: Date): Promise<OzonOrder[]> {
    const allOrders: OzonOrder[] = [];

    const headers = {
      'Content-Type': 'application/json',
      'Client-Id': clientId,
      'Api-Key': apiKey,
    };

    // 1. Fetch FBO Orders
    try {
      const fboRes = await fetchWithRetry('https://api-seller.ozon.ru/v2/posting/fbo/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dir: 'ASC',
          filter: {
            since: dateFrom.toISOString(),
            status: 'delivered',
          },
          limit: 1000,
        }),
      });

      if (fboRes.ok) {
        const data = (await fboRes.json()) as { result: OzonOrder[] };
        allOrders.push(...(data.result || []));
      }
    } catch (e) {
      console.warn('Ozon FBO fetch error:', e);
    }

    // 2. Fetch FBS Orders (delivered only for sales history)
    try {
      const fbsRes = await fetchWithRetry('https://api-seller.ozon.ru/v3/posting/fbs/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          dir: 'ASC',
          filter: {
            since: dateFrom.toISOString(),
            status: 'delivered',
          },
          limit: 1000,
        }),
      });

      if (fbsRes.ok) {
        const data = (await fbsRes.json()) as { result: { postings: OzonOrder[] } };
        allOrders.push(...(data.result?.postings || []));
      }
    } catch (e) {
      console.warn('Ozon FBS fetch error:', e);
    }

    return allOrders;
  }
}

export const ozonService = new OzonService();
