import {
  marketplaceService,
  OZON_DISCOUNT_CONFIG,
  WB_DISCOUNT_CONFIG,
  calculateOzonBuyerPrice,
  calculateWbBuyerPrice,
} from '../core-services/MarketplaceService.js';
import { wbService } from '../core-services/WbService.js';
import { ozonService } from '../core-services/OzonService.js';
import { marketplaceAccountRepository } from '../repositories/MarketplaceAccountRepository.js';

// Types re-export
export type {
  MarketplaceProduct,
  MarketplaceSalesStats,
} from '../core-services/MarketplaceTypes.js';
export interface MarketplaceApiKeys {
  wb?: string;
  ozon?: { clientId: string; apiKey: string };
}
export interface MarketplacePriceUpdate {
  product_id: string;
  nm_id?: number;
  new_price: number;
  marketplace: 'WB' | 'Ozon';
}

// Key Management
export const getMarketplaceKeys = (userId: string | number, accountId?: number) =>
  marketplaceAccountRepository.getKeys(userId, accountId);

// WB Functions
export const fetchWbProducts = (apiKey: string, limit = 100) =>
  wbService.fetchProducts(apiKey, limit);
export const fetchWbPrices = (apiKey: string, nmIds: number[]) =>
  wbService.fetchPrices(apiKey, nmIds);
export const fetchWbStocks = (apiKey: string, nmIds: number[]) =>
  wbService.fetchStocks(apiKey, nmIds);
export const updateWbPrices = (apiKey: string, updates: Array<{ nmId: number; price: number }>) =>
  wbService.updatePrices(apiKey, updates);
export const fetchWbSalesStats = (apiKey: string, dateFrom: Date) =>
  wbService.fetchSalesStats(apiKey, dateFrom);
export const fetchWbOrders = (apiKey: string, dateFrom: Date) =>
  wbService.fetchOrders(apiKey, dateFrom);
export const setWbZeroStock = (apiKey: string, skus: string[]) =>
  wbService.setZeroStock(apiKey, skus);
// setWbDefensePrice -> updateWbPrices wrapper?
export const setWbDefensePrice = (
  apiKey: string,
  products: Array<{ nmId: number; price: number }>
) => wbService.updatePrices(apiKey, products);
export const updateWbStockFbs = (
  apiKey: string,
  warehouseId: number,
  updates: Array<{ sku: string; amount: number }>
) => wbService.updateStock(apiKey, warehouseId, updates);
export const getWbFbsWarehouses = (apiKey: string) => wbService.getWarehouses(apiKey);

// Ozon Functions
export const fetchOzonProducts = (clientId: string, apiKey: string, limit = 100) =>
  ozonService.fetchProducts(clientId, apiKey, limit);
export const updateOzonPrices = (
  clientId: string,
  apiKey: string,
  updates: Array<{ productId: number; price: number }>
) => ozonService.updatePrices(clientId, apiKey, updates);
export const fetchOzonSalesStats = (
  clientId: string,
  apiKey: string,
  dateFrom: Date,
  dateTo: Date
) => ozonService.fetchSalesStats(clientId, apiKey, dateFrom, dateTo);
export const fetchOzonCurrentPrices = (clientId: string, apiKey: string, productIds: number[]) =>
  ozonService.fetchCurrentPrices(clientId, apiKey, productIds);
// fetchOzonProductInfo -> Use fetchProducts or similar? fetchProducts uses fetchProductInfo internally.
// But some old code might call `fetchOzonProductInfo` directly?
// In `marketplace.ts`, `fetchOzonProductInfo` calls `v2/product/info`.
// I don't have direct export for strictly `fetchProductInfo` in `OzonService`, but `fetchProducts` logic does it.
// I will implement a wrapper if needed or add it to OzonService.
// Let's assume for now we can add `fetchProductInfo` to OzonService if strict compatibility is needed.
// Checking `OzonService`... it has `fetchProducts` which does list + info.
// I'll add `fetchProductInfo` to OzonService to be safe.
export const fetchOzonProductInfo = (clientId: string, apiKey: string, productIds: string[]) => {
  // Calling internal implementation via private/public, I need to expose it or reimplement.
  // For now, let's assume I can add it to OzonService.
  return ozonService.fetchProductInfo(clientId, apiKey, productIds);
};

export const fetchOzonStocksV3 = (clientId: string, apiKey: string, limit = 100) =>
  ozonService.fetchStocks(clientId, apiKey, limit);
export const fetchOzonAnalytics = (
  clientId: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  metrics?: string[]
) => ozonService.fetchAnalytics(clientId, apiKey, dateFrom, dateTo, metrics);
export const fetchOzonOrders = (clientId: string, apiKey: string, dateFrom: Date) =>
  ozonService.fetchOrders(clientId, apiKey, dateFrom);
export const fetchOzonFbsUnfulfilledOrders = (clientId: string, apiKey: string) =>
  ozonService.fetchUnfulfilledOrders(clientId, apiKey);
export const setOzonZeroStock = (
  clientId: string,
  apiKey: string,
  products: Array<{ productId: number; offerId: string }>
) => ozonService.setZeroStock(clientId, apiKey, products);
export const setOzonDefensePrice = (
  clientId: string,
  apiKey: string,
  products: Array<{ productId: number; offerId: string; price: number }>
) => ozonService.setDefensePrice(clientId, apiKey, products);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateOzonStockFbs = (clientId: string, apiKey: string, updates: any[]) =>
  ozonService.updateStockFbs(clientId, apiKey, updates);
export const getOzonFbsWarehouses = (clientId: string, apiKey: string) =>
  ozonService.getFbsWarehouses(clientId, apiKey);

// Utils
export { OZON_DISCOUNT_CONFIG, WB_DISCOUNT_CONFIG, calculateOzonBuyerPrice, calculateWbBuyerPrice };

// Sync
export const syncSalesHistory = (userId: string | number, daysBack = 30, accountId?: number) =>
  marketplaceService.syncSalesHistory(userId, daysBack, accountId);
