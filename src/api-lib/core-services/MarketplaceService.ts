import { wbService } from './WbService.js';
import { ozonService } from './OzonService.js';
import { marketplaceAccountRepository } from '../repositories/MarketplaceAccountRepository.js';
import type { MarketplaceProduct, MarketplaceSalesStats } from './MarketplaceTypes.js';
import { upsertMarketplaceOrders, type MarketplaceOrder } from '../services/database.js';
import type { WbStatisticsSale, OzonOrder } from '../lib/marketplace-types.js';
import { withCircuitBreaker } from '../lib/index.js';

// ============================================
// MARKETPLACE DISCOUNT ESTIMATION
// ============================================

export const OZON_DISCOUNT_CONFIG = {
  cardDiscount: 5,
  cardAdoptionRate: 0.4,
  averageCardImpact: 2,
  typicalPromoMin: 0,
  typicalPromoMax: 10,
  defaultEstimatedDiscount: 5,
};

export const WB_DISCOUNT_CONFIG = {
  walletCashback: 3,
  defaultEstimatedDiscount: 3,
};

export function calculateOzonBuyerPrice(
  sellerPrice: number,
  hasPromotion = false
): { price: number; discountPercent: number } {
  let discountPercent = OZON_DISCOUNT_CONFIG.cardDiscount;
  if (hasPromotion) {
    discountPercent += 5;
  }
  const buyerPrice = Math.round(sellerPrice * (1 - discountPercent / 100));
  return { price: buyerPrice, discountPercent };
}

export function calculateWbBuyerPrice(
  sellerPrice: number,
  hasPromotion = false
): { price: number; discountPercent: number } {
  let discountPercent = WB_DISCOUNT_CONFIG.walletCashback;
  if (hasPromotion) {
    discountPercent += 3;
  }
  const buyerPrice = Math.round(sellerPrice * (1 - discountPercent / 100));
  return { price: buyerPrice, discountPercent };
}

export class MarketplaceService {
  /**
   * Fetch products from specific marketplace
   */
  async fetchProducts(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    limit = 100,
    accountId?: number
  ): Promise<MarketplaceProduct[]> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);

    if (marketplace === 'WB') {
      if (!keys.wb) throw new Error('WB API key not configured');
      return wbService.fetchProducts(keys.wb, limit);
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) throw new Error('Ozon API keys not configured');
      return ozonService.fetchProducts(keys.ozon.clientId, keys.ozon.apiKey, limit);
    }

    throw new Error(`Unsupported marketplace: ${marketplace}`);
  }

  /**
   * Update prices
   */
  async updatePrices(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    updates: Array<{ id: string | number; price: number }>,
    accountId?: number
  ): Promise<{
    success: boolean;
    count: number;
    error?: string;
    taskId?: number;
    partialErrors?: string[];
  }> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);

    if (marketplace === 'WB') {
      if (!keys.wb) throw new Error('WB API key not configured');

      // Map id to nmId
      const wbUpdates = updates.map(u => ({
        nmId: Number(u.id),
        price: u.price,
      }));
      return wbService.updatePrices(keys.wb, wbUpdates);
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) throw new Error('Ozon API keys not configured');

      const ozonUpdates = updates.map(u => ({
        productId: Number(u.id),
        price: u.price,
      }));
      return ozonService.updatePrices(keys.ozon.clientId, keys.ozon.apiKey, ozonUpdates);
    }

    return { success: false, count: 0, error: 'Unsupported marketplace' };
  }

  /**
   * Fetch current prices only (lightweight, for monitoring)
   */
  async fetchCurrentPrices(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    productIds: (string | number)[],
    accountId?: number
  ): Promise<{ prices: Map<string | number, number>; errors?: string[] }> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);
    const errors: string[] = [];
    const prices = new Map<string | number, number>();

    if (marketplace === 'WB') {
      if (!keys.wb) {
        errors.push('WB API key not configured');
        return { prices, errors };
      }
      // Cast to numbers for WB
      const nmIds = productIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
      try {
        const result = await withCircuitBreaker('wb-prices', () =>
          wbService.fetchPrices(keys.wb!, nmIds)
        );

        if (result.error) errors.push(`WB Error: ${result.error}`);
        if (result.priceMap) {
          for (const [id, price] of result.priceMap.entries()) {
            prices.set(id, price);
          }
        }
      } catch (error: unknown) {
        errors.push(
          `WB Circuit Breaker: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return { prices, errors: errors.length > 0 ? errors : undefined };
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) {
        errors.push('Ozon API keys not configured');
        return { prices, errors };
      }
      // Cast to numbers (ozon product_ids)
      // Expecting productIds to be raw numbers or strings that parse to numbers
      const ozonIds = productIds
        .map(id => {
          const str = String(id);
          return str.startsWith('ozon-') ? Number(str.replace('ozon-', '')) : Number(str);
        })
        .filter(id => !isNaN(id) && id > 0);

      try {
        const ozonPrices = await withCircuitBreaker('ozon-prices', () =>
          ozonService.fetchCurrentPrices(keys.ozon!.clientId, keys.ozon!.apiKey, ozonIds)
        );

        for (const [id, price] of ozonPrices.entries()) {
          prices.set(id, price);
        }
      } catch (error: unknown) {
        errors.push(
          `Ozon Circuit Breaker: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return { prices, errors: errors.length > 0 ? errors : undefined };
    }

    return { prices, errors: ['Unsupported marketplace'] };
  }

  /**
   * Set Zero Stock (Defense Action)
   */
  async setZeroStock(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    products: Array<{ id: string | number; offerId?: string }>,
    accountId?: number
  ): Promise<{ success: boolean; error?: string }> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);

    if (marketplace === 'WB') {
      if (!keys.wb) return { success: false, error: 'No WB keys' };
      const skus = products.map(p => String(p.id)); // WB uses skus (nmId as string often)
      return await wbService.setZeroStock(keys.wb, skus);
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) return { success: false, error: 'No Ozon keys' };
      // Map to format required by OzonService
      const items = products.map(p => ({
        productId: typeof p.id === 'string' ? parseInt(p.id.replace('ozon-', '')) : p.id,
        offerId: p.offerId || String(p.id),
      }));
      return await ozonService.setZeroStock(keys.ozon.clientId, keys.ozon.apiKey, items);
    }

    return { success: false, error: 'Unsupported marketplace' };
  }

  /**
   * Set Defense Price (Defense Action)
   */
  async setDefensePrice(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    products: Array<{ id: string | number; offerId?: string; price: number }>,
    accountId?: number
  ): Promise<{ success: boolean; error?: string }> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);

    if (marketplace === 'WB') {
      if (!keys.wb) return { success: false, error: 'No WB keys' };
      // Map to update format
      const updates = products.map(p => ({
        nmId: Number(p.id),
        price: p.price,
      }));
      const res = await wbService.updatePrices(keys.wb, updates);
      return { success: res.success, error: res.error };
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) return { success: false, error: 'No Ozon keys' };
      const items = products.map(p => ({
        productId: typeof p.id === 'string' ? parseInt(p.id.replace('ozon-', '')) : p.id,
        offerId: p.offerId || String(p.id),
        price: p.price,
      }));
      return await ozonService.setDefensePrice(keys.ozon.clientId, keys.ozon.apiKey, items);
    }

    return { success: false, error: 'Unsupported marketplace' };
  }

  /**
   * Fetch Sales Statistics
   */
  async fetchSalesStats(
    userId: number,
    marketplace: 'WB' | 'Ozon',
    dateFrom: Date,
    dateTo: Date,
    accountId?: number
  ): Promise<MarketplaceSalesStats | null> {
    const keys = await marketplaceAccountRepository.getKeys(userId, accountId);

    if (marketplace === 'WB') {
      if (!keys.wb) return null;
      return await wbService.fetchSalesStats(keys.wb, dateFrom);
    }

    if (marketplace === 'Ozon') {
      if (!keys.ozon) return null;
      return await ozonService.fetchSalesStats(
        keys.ozon.clientId,
        keys.ozon.apiKey,
        dateFrom,
        dateTo
      );
    }

    return null;
  }

  /**
   * Sync sales history from marketplaces to local DB
   */
  async syncSalesHistory(
    userId: number,
    daysBack: number = 30,
    accountId?: number
  ): Promise<{ success: boolean; imported: number; error?: string }> {
    try {
      const keys = await marketplaceAccountRepository.getKeys(userId, accountId);
      let totalImported = 0;
      const orders: MarketplaceOrder[] = [];

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysBack);

      // 1. Fetch WB Orders
      if (keys.wb) {
        try {
          const wbOrders = await wbService.fetchOrders(keys.wb, dateFrom);
          const mappedWb: MarketplaceOrder[] = wbOrders
            .filter((o: WbStatisticsSale) => o.nmId && (o.srid || o.saleID))
            .map((o: WbStatisticsSale) => ({
              order_id: o.srid || o.saleID || 'unknown',
              user_id: userId,
              marketplace_product_id: String(o.nmId),
              title: o.subject || `Товар ${o.nmId}`,
              marketplace: 'WB',
              order_date: new Date(o.date || 0),
              status:
                (o.saleID && o.saleID.startsWith('R')) || o.isStorned ? 'returned' : 'delivered',
              price_total: o.finishedPrice || o.priceWithDisc || 0,
              quantity: 1,
              commission: 0,
              logistics: 0,
              cost_price: 0,
              region: o.regionName || null,
              account_id: accountId || null,
            }));
          orders.push(...mappedWb);
          console.log(`📥 Sync: Fetched ${mappedWb.length} WB orders`);
        } catch (e) {
          console.warn('⚠️ Sync: Failed to fetch WB orders:', e);
        }
      }

      // 2. Fetch Ozon Orders
      if (keys.ozon) {
        try {
          const ozonOrders = await ozonService.fetchOrders(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            dateFrom
          );
          const mappedOzon: MarketplaceOrder[] = ozonOrders.map((o: OzonOrder) => ({
            order_id: o.posting_number,
            user_id: userId,
            marketplace_product_id: String(o.products?.[0]?.sku || o.products?.[0]?.offer_id),
            title: o.products?.[0]?.name || 'Ozon Product',
            marketplace: 'Ozon',
            order_date: new Date(o.in_process_at || o.created_at),
            status: o.status,
            price_total: parseFloat(o.financial_data?.products?.[0]?.price || '0'),
            quantity: o.products?.[0]?.quantity || 1,
            commission: parseFloat(o.financial_data?.products?.[0]?.commission_amount || '0'),
            logistics: 0,
            cost_price: 0,
            region: o.analytics_data?.region || o.region,
            account_id: accountId || null,
          }));
          orders.push(...mappedOzon);
          console.log(`📥 Sync: Fetched ${mappedOzon.length} Ozon orders`);
        } catch (e) {
          console.warn('⚠️ Sync: Failed to fetch Ozon orders:', e);
        }
      }

      // 3. Save to DB
      if (orders.length > 0) {
        const result = await upsertMarketplaceOrders(userId, orders);
        totalImported = result.inserted + result.updated;
        console.log(
          `💾 Sync: Saved ${totalImported} orders to history (Date > ${dateFrom.toISOString()})`
        );
      }

      return { success: true, imported: totalImported };
    } catch (e) {
      console.error('❌ Sync Sales History Failed:', e);
      return {
        success: false,
        imported: 0,
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const marketplaceService = new MarketplaceService();
