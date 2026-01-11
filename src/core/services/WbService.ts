import { fetchWithRetry } from '../../api-lib/lib/index.js';
import type {
  WbCard,
  WbGoodsItem,
  WbTaskHistoryItem,
  WbTaskDetail,
  WbStatisticsSale,
} from '../../api-lib/lib/marketplace-types.js';
import type { MarketplaceProduct, MarketplaceSalesStats } from './MarketplaceTypes.js';

export class WbService {
  private readonly PRICE_API_URL = 'https://discounts-prices-api.wildberries.ru/api/v2';
  private readonly CONTENT_API_URL = 'https://content-api.wildberries.ru/content/v2';
  private readonly STATISTICS_API_URL = 'https://statistics-api.wildberries.ru/api/v1';
  private readonly WAREHOUSES_API_URL = 'https://marketplace-api.wildberries.ru/api/v3';

  /**
   * Fetch products from WB Content API with REAL stocks
   */
  async fetchProducts(apiKey: string, limit = 100): Promise<MarketplaceProduct[]> {
    // Step 1: Get product cards from Content API
    const cardsResponse = await fetch(`${this.CONTENT_API_URL}/get/cards/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        settings: { cursor: { limit }, filter: { withPhoto: -1 } },
      }),
    });

    if (!cardsResponse.ok) {
      throw new Error(`WB Content API error: ${cardsResponse.status}`);
    }

    const cardsData = await cardsResponse.json();
    const cards: WbCard[] = cardsData.cards || [];
    const nmIds = cards.map(card => card.nmID);

    // Step 2: Fetch REAL prices from Prices API
    const { priceMap } = await this.fetchPrices(apiKey, nmIds);

    // Step 3: Fetch REAL stocks from Warehouse Stocks API
    const stockMap = await this.fetchStocks(apiKey, nmIds);

    // Step 4: Map to unified format
    return cards.map(card => ({
      product_id: `wb-${card.nmID}`,
      nm_id: card.nmID,
      title: card.title || card.subjectName || 'Без названия',
      image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
      current_price: priceMap.get(card.nmID) || 0,
      current_stock: stockMap.get(card.nmID) || 0,
      marketplace: 'WB' as const,
    }));
  }

  /**
   * Fetch prices from WB Prices API
   */
  async fetchPrices(
    apiKey: string,
    nmIds: number[]
  ): Promise<{ priceMap: Map<number, number>; error?: string }> {
    const priceMap = new Map<number, number>();

    if (nmIds.length === 0) return { priceMap };

    try {
      // Step 1: Try Prices API first
      console.log(`📡 WB Prices API: bulk fetch for ${nmIds.length} products`);

      const url = new URL(`${this.PRICE_API_URL}/list/goods/filter`);
      url.searchParams.set('limit', '1000');
      url.searchParams.set('offset', '0');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: apiKey },
      });

      if (response.ok) {
        const data = await response.json();
        const goods = data.data?.listGoods || [];

        console.log(`📦 WB Prices API: received ${goods.length} goods`);

        const requestedNmIds = new Set(nmIds);

        for (const good of goods) {
          if (nmIds.length === 0 || requestedNmIds.has(good.nmID)) {
            const price = this.extractPrice(good);
            if (price > 0) {
              priceMap.set(good.nmID, price);
            }
          }
        }
      } else {
        console.warn(`⚠️ WB Prices API error: ${response.status}`);
      }

      // Step 2: Statistics API fallback for missing prices
      const missing = nmIds.filter(id => !priceMap.has(id));
      if (missing.length > 0) {
        console.log(`📡 WB: ${missing.length} products missing prices, trying Statistics API...`);

        const today = new Date();
        const dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - 30); // Last 30 days

        try {
          const salesRes = await fetch(
            `${this.STATISTICS_API_URL}/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
            {
              method: 'GET',
              headers: { Authorization: apiKey },
            }
          );

          if (salesRes.ok) {
            const sales = await salesRes.json();
            const missingSet = new Set(missing);

            if (Array.isArray(sales)) {
              for (const sale of sales) {
                if (sale.nmId && missingSet.has(sale.nmId) && !priceMap.has(sale.nmId)) {
                  // Use priceWithDisc or finishedPrice
                  const price = sale.finishedPrice || sale.priceWithDisc || 0;
                  if (price > 0) {
                    priceMap.set(sale.nmId, Math.round(price));
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ WB Statistics API fallback failed:', e);
        }
      }

      return { priceMap };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      console.warn('Failed to fetch WB prices:', e);
      return { priceMap, error };
    }
  }

  /**
   * Fetch WB stocks
   */
  async fetchStocks(apiKey: string, nmIds: number[]): Promise<Map<number, number>> {
    const stockMap = new Map<number, number>();

    if (nmIds.length === 0) return stockMap;

    try {
      // Step 1: Try FBS warehouses first
      const warehousesRes = await fetch(`${this.WAREHOUSES_API_URL}/warehouses`, {
        method: 'GET',
        headers: { Authorization: apiKey },
      });

      if (warehousesRes.ok) {
        const warehouses = await warehousesRes.json();

        if (Array.isArray(warehouses) && warehouses.length > 0) {
          const skus = nmIds.map(id => String(id));

          for (const wh of warehouses) {
            try {
              const stocksRes = await fetch(`${this.WAREHOUSES_API_URL}/stocks/${wh.id}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: apiKey,
                },
                body: JSON.stringify({ skus }),
              });

              if (stocksRes.ok) {
                const stocksData = await stocksRes.json();
                const stocks = stocksData.stocks || [];

                for (const stock of stocks) {
                  const nmId = parseInt(stock.sku);
                  if (!isNaN(nmId)) {
                    const current = stockMap.get(nmId) || 0;
                    stockMap.set(nmId, current + (stock.amount || 0));
                  }
                }
              }
            } catch (e) {
              console.warn(`⚠️ WB Stocks error for warehouse ${wh.id}:`, e);
            }
          }
        }
      }

      // Step 2: FBO fallback - use Statistics API
      if (stockMap.size === 0) {
        const today = new Date();
        const dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - 1);

        const fboRes = await fetch(
          `${this.STATISTICS_API_URL}/supplier/stocks?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
          {
            method: 'GET',
            headers: { Authorization: apiKey },
          }
        );

        if (fboRes.ok) {
          const fboStocks = await fboRes.json();
          if (Array.isArray(fboStocks)) {
            for (const item of fboStocks) {
              const nmId = item.nmId;
              if (nmId && nmIds.includes(nmId)) {
                const current = stockMap.get(nmId) || 0;
                stockMap.set(nmId, current + (item.quantityFull || item.quantity || 0));
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ WB Stocks API error:', e);
    }

    return stockMap;
  }

  /**
   * Update prices on WB
   */
  async updatePrices(
    apiKey: string,
    updates: Array<{ nmId: number; price: number }>
  ): Promise<{ success: boolean; count: number; error?: string; taskId?: number }> {
    if (updates.length === 0) {
      return { success: true, count: 0 };
    }

    const validUpdates = updates.filter(
      u => Number.isFinite(u.nmId) && u.nmId > 0 && Number.isFinite(u.price) && u.price > 0
    );

    if (validUpdates.length === 0) {
      return { success: false, count: 0, error: 'No valid updates (checks failed)' };
    }

    // Batch limit: 200 items
    const batchedUpdates = validUpdates.slice(0, 200);

    try {
      const payload = {
        data: batchedUpdates.map(u => ({
          nmID: u.nmId,
          price: u.price,
          discount: 0,
        })),
      };

      const response = await fetchWithRetry(`${this.PRICE_API_URL}/upload/task`, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseBody = await response.json();

        if (responseBody.error) {
          return { success: false, count: 0, error: responseBody.errorText };
        }

        const taskId = responseBody.data?.id;
        return { success: true, count: batchedUpdates.length, taskId };
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
   * Check task status
   */
  async checkTaskStatus(
    apiKey: string,
    taskId: number
  ): Promise<{
    completed: boolean;
    hasErrors: boolean;
    errors?: string[];
    status?: string;
  }> {
    try {
      const response = await fetchWithRetry(`${this.PRICE_API_URL}/history/tasks`, {
        method: 'GET',
        headers: { Authorization: apiKey },
      });

      if (!response.ok) {
        return { completed: false, hasErrors: true, errors: ['Failed to fetch task status'] };
      }

      const data = await response.json();
      const tasks: WbTaskHistoryItem[] = data.data || [];
      const task = tasks.find(t => t.id === taskId);

      if (!task) {
        return { completed: false, hasErrors: false, status: 'processing' };
      }

      const details: WbTaskDetail[] = task.details || [];
      const failedItems = details.filter(d => d.status === 'rejected' || d.errorText);
      const errors = failedItems.map(e => `nmID ${e.nmID}: ${e.errorText || 'rejected'}`);

      return {
        completed: task.status === 'completed' || task.status === 'done',
        hasErrors: failedItems.length > 0,
        errors: failedItems.length > 0 ? errors : undefined,
        status: task.status,
      };
    } catch (e) {
      return {
        completed: false,
        hasErrors: true,
        errors: [e instanceof Error ? e.message : 'Unknown error'],
      };
    }
  }

  private extractPrice(good: WbGoodsItem): number {
    const size = good.sizes?.[0];
    let price = 0;

    if (size) {
      price =
        size.discountedPrice ||
        size.clubDiscountedPrice ||
        size.salePrice ||
        size.price ||
        good.price ||
        0;
    }

    return Math.round(price);
  }
  /**
   * Get WB FBS warehouses
   */
  async getWarehouses(
    apiKey: string
  ): Promise<{ warehouses: Array<{ id: number; name: string }>; error?: string }> {
    try {
      const response = await fetchWithRetry(`${this.WAREHOUSES_API_URL}/warehouses`, {
        method: 'GET',
        headers: { Authorization: apiKey },
      });

      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const warehouses = (data || []).map((w: any) => ({
          id: w.id,
          name: w.name || `Склад ${w.id}`,
        }));
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
   * Update WB stock (FBS)
   */
  async updateStock(
    apiKey: string,
    warehouseId: number,
    updates: Array<{ sku: string; amount: number }>
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (updates.length === 0) return { success: true, count: 0 };

    try {
      const payload = {
        stocks: updates.map(u => ({
          sku: u.sku,
          amount: u.amount,
        })),
      };

      const response = await fetchWithRetry(`${this.WAREHOUSES_API_URL}/stocks/${warehouseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true, count: updates.length };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorText = errorData.message || errorData.error || `HTTP ${response.status}`;
        return { success: false, count: 0, error: errorText };
      }
    } catch (e) {
      return { success: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Set Zero Stock for WB (Defense) - Updates all warehouses
   */
  async setZeroStock(
    apiKey: string,
    skus: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (skus.length === 0) return { success: true };

    const { warehouses, error } = await this.getWarehouses(apiKey);
    if (error) return { success: false, error: `Failed to fetch warehouses: ${error}` };

    if (!warehouses || warehouses.length === 0) {
      // If no warehouses, maybe FBO only? But we can't zero FBO stock via API generally (it's physical).
      // So we assume success if no warehouses to update.
      return { success: true };
    }

    let hasErrors = false;
    const errors: string[] = [];

    for (const wh of warehouses) {
      const res = await this.updateStock(
        apiKey,
        wh.id,
        skus.map(sku => ({ sku, amount: 0 }))
      );
      if (!res.success) {
        hasErrors = true;
        errors.push(`Warehouse ${wh.id}: ${res.error}`);
      }
    }

    if (hasErrors) {
      return { success: false, error: errors.join('; ') };
    }

    return { success: true };
  }

  /**
   * Get sales stats from WB
   */
  async fetchSalesStats(apiKey: string, dateFrom: Date): Promise<MarketplaceSalesStats | null> {
    try {
      const response = await fetchWithRetry(
        `${this.STATISTICS_API_URL}/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
        {
          method: 'GET',
          headers: { Authorization: apiKey },
        }
      );

      if (response.ok) {
        const sales = await response.json();

        let revenue = 0,
          orders = 0,
          returns = 0;

        for (const sale of sales || []) {
          if (sale.saleID && !sale.saleID.startsWith('R')) {
            orders++;
            revenue += sale.finishedPrice || sale.priceWithDisc || 0;
          } else if (sale.saleID?.startsWith('R')) {
            returns++;
          }
        }

        return {
          period: 'custom',
          dateFrom: dateFrom.toISOString().split('T')[0],
          dateTo: new Date().toISOString().split('T')[0],
          orders,
          revenue: Math.round(revenue),
          returns,
        };
      }
    } catch (e) {
      console.error('WB stats error:', e);
    }

    return null;
  }

  /**
   * Fetch raw WB sales data (Orders)
   */
  async fetchOrders(apiKey: string, dateFrom: Date): Promise<WbStatisticsSale[]> {
    try {
      const response = await fetchWithRetry(
        `${this.STATISTICS_API_URL}/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
        {
          method: 'GET',
          headers: { Authorization: apiKey },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = data as any[];
        if (Array.isArray(items)) {
          return items as WbStatisticsSale[];
        }
      } else {
        const txt = await response.text();
        console.warn(`WB Statistics API error: ${response.status} ${txt}`);
      }
    } catch (e) {
      console.warn('WB fetchOrders error:', e);
    }
    return [];
  }
}

export const wbService = new WbService();
