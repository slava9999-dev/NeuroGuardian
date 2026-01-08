// ============================================
// NeuroGUARDIAN — Marketplace Service
// Unified API client for WB and Ozon
// Single Source of Truth for marketplace operations
// ============================================

import { decryptApiKey, fetchWithRetry } from '../lib/index.js';
import { getUserById, upsertMarketplaceOrders, type MarketplaceOrder } from './database.js';
import type {
  WbCard,
  WbGoodsItem,
  WbTaskHistoryItem,
  WbTaskDetail,
  OzonProductInfo,
  OzonStockItem,
  OzonPriceUpdateResult,
  OzonError,
  WbWarehouse,
  WbStockItem,
  WbUploadTaskResponse,
  OzonProductListItem,
  OzonAnalyticsRow,
  OzonWarehouse,
  OzonOrder,
  WbStatisticsStock,
  WbStatisticsSale,
  OzonStockV3Response,
} from '../lib/marketplace-types.js';
// import { logger } from '../lib/index.js'; // TEMP: Unused while using console.log

// ============================================
// TYPES
// ============================================

export interface MarketplaceProduct {
  product_id: string;
  nm_id?: number;
  title: string;
  image_url: string | null;
  current_price: number; // Seller's price
  estimated_buyer_price?: number; // Estimated price buyer sees (after discounts)
  marketplace_discount_percent?: number; // Total estimated discount %
  current_stock: number;
  marketplace: 'WB' | 'Ozon';
}

export interface MarketplacePriceUpdate {
  product_id: string;
  nm_id?: number;
  new_price: number;
  marketplace: 'WB' | 'Ozon';
}

export interface MarketplaceSalesStats {
  period: string;
  dateFrom: string;
  dateTo: string;
  orders: number;
  revenue: number;
  returns: number;
}

export interface MarketplaceApiKeys {
  wb?: string;
  ozon?: { clientId: string; apiKey: string };
}

// ============================================
// MARKETPLACE DISCOUNT ESTIMATION
// ============================================
// Since Ozon removed marketing_price from API (Nov 2025),
// we need to estimate the buyer-facing price

/**
 * Ozon discount factors:
 * - Ozon Card: 5% discount, ~40% adoption = ~2% average impact
 * - Ozon Premium: additional discounts for subscribers
 * - Promotional actions: can add 5-15% more
 */
export const OZON_DISCOUNT_CONFIG = {
  /** Ozon Card discount percentage */
  cardDiscount: 5,
  /** Estimated adoption rate of Ozon Card holders */
  cardAdoptionRate: 0.4,
  /** Average Ozon Card impact on price = 5% * 40% = 2% */
  averageCardImpact: 2,
  /** Typical promotional discount range */
  typicalPromoMin: 0,
  typicalPromoMax: 10,
  /** Default estimated total discount (conservative) */
  defaultEstimatedDiscount: 5,
};

/**
 * Wildberries discount factors:
 * - WB Wallet cashback: ~2-5%
 * - SPP (discount from price): varies
 * - Promotional actions
 */
export const WB_DISCOUNT_CONFIG = {
  /** WB Wallet typical cashback */
  walletCashback: 3,
  /** Default estimated total discount */
  defaultEstimatedDiscount: 3,
};

/**
 * Calculate estimated buyer price for Ozon
 * Shows price that buyers WITH Ozon Card will see (5% discount)
 * Note: This is the MINIMUM price visible, actual price may be lower with promotions
 * @param sellerPrice - Price set by seller
 * @param hasPromotion - True if product is in an active promotion
 * @returns Estimated price buyer sees WITH Ozon Card
 */
export function calculateOzonBuyerPrice(
  sellerPrice: number,
  hasPromotion = false
): { price: number; discountPercent: number } {
  // Use ACTUAL Ozon Card discount (5%), not average impact
  // This shows what buyers WITH Ozon Card will see
  let discountPercent = OZON_DISCOUNT_CONFIG.cardDiscount; // 5%

  // Add typical promo discount if in promotion
  if (hasPromotion) {
    discountPercent += 5; // Conservative estimate for promotions
  }

  // Apply discount to seller price
  const buyerPrice = Math.round(sellerPrice * (1 - discountPercent / 100));

  return { price: buyerPrice, discountPercent };
}

/**
 * Calculate estimated buyer price for Wildberries
 */
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

// ============================================
// API KEY HELPERS
// ============================================

import { getAccountById } from './users.js';

/**
 * Get decrypted marketplace API keys for a user or a specific account
 */
export async function getMarketplaceKeys(
  userId: number,
  accountId?: number
): Promise<MarketplaceApiKeys> {
  const result: MarketplaceApiKeys = {};

  if (accountId) {
    const account = await getAccountById(accountId);
    if (!account) return {};

    if (account.marketplace === 'wb' && account.wb_token) {
      const decrypted = decryptApiKey(account.wb_token);
      if (decrypted) result.wb = decrypted;
    } else if (account.marketplace === 'ozon' && account.ozon_client_id && account.ozon_api_key) {
      const clientDecrypted = decryptApiKey(account.ozon_client_id);
      const keyDecrypted = decryptApiKey(account.ozon_api_key);
      if (clientDecrypted && keyDecrypted) {
        result.ozon = { clientId: clientDecrypted, apiKey: keyDecrypted };
      }
    }
    return result;
  }

  // Fallback to legacy user columns
  const user = await getUserById(userId);
  if (!user) return {};

  if (user.api_key_wb) {
    const decrypted = decryptApiKey(user.api_key_wb);
    if (decrypted) result.wb = decrypted;
  }

  if (user.api_key_ozon) {
    const decrypted = decryptApiKey(user.api_key_ozon);
    if (decrypted) {
      // 1. Check if it's modern format "CLIENT_ID:API_KEY"
      if (decrypted.includes(':')) {
        const [clientId, apiKey] = decrypted.split(':');
        if (clientId && apiKey) result.ozon = { clientId, apiKey };
      }
      // 2. Fallback to separate ozon_client_id column if present
      else if (user.ozon_client_id) {
        const clientId = decryptApiKey(user.ozon_client_id);
        if (clientId) result.ozon = { clientId, apiKey: decrypted };
      }
    }
  }

  return result;
}

// ============================================
// WILDBERRIES API
// ============================================

/**
 * Fetch WB stocks from Warehouse Stocks API
 * Returns a map of nmId -> total stock across all warehouses
 * IMPROVED (Dec 2024): Added FBO fallback via Statistics API
 */
export async function fetchWbStocks(apiKey: string, nmIds: number[]): Promise<Map<number, number>> {
  const stockMap = new Map<number, number>();

  if (nmIds.length === 0) return stockMap;

  console.log(`🚀 WB STOCKS START: Fetching for ${nmIds.length} products, first nmId=${nmIds[0]}`);

  try {
    // Step 1: Try FBS warehouses first
    console.log(`🔍 WB FBS: Fetching warehouses...`);
    const warehousesRes = await fetchWithRetry(
      'https://marketplace-api.wildberries.ru/api/v3/warehouses',
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    console.log(`📡 WB Warehouses API: status=${warehousesRes.status}`);

    if (warehousesRes.ok) {
      const warehouses = (await warehousesRes.json()) as WbWarehouse[];
      console.log(
        `📦 WB FBS: Found ${Array.isArray(warehouses) ? warehouses.length : 0} warehouses`
      );

      if (Array.isArray(warehouses) && warehouses.length > 0) {
        // Log warehouse names
        console.log(`📦 WB Warehouses: ${warehouses.map(w => `${w.name || w.id}`).join(', ')}`);

        // FBS mode - get stocks from seller's warehouses
        // Prepare SKUs from nmIds (WB uses nmId as SKU string)
        const skus = nmIds.map(id => String(id));
        console.log(`📦 WB: Will request stocks for ${skus.length} SKUs`);

        for (const wh of warehouses) {
          try {
            console.log(
              `🔍 WB: Fetching stocks for warehouse ${wh.id} (${wh.name || 'unnamed'})...`
            );
            const stocksRes = await fetchWithRetry(
              `https://marketplace-api.wildberries.ru/api/v3/stocks/${wh.id}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: apiKey,
                },
                body: JSON.stringify({ skus }), // Pass nmIds as SKU strings
              }
            );

            console.log(`📡 WB Stocks API (wh ${wh.id}): status=${stocksRes.status}`);

            if (stocksRes.ok) {
              const stocksData = (await stocksRes.json()) as { stocks: WbStockItem[] };
              const stocks = stocksData.stocks || [];
              console.log(`📦 WB Warehouse ${wh.id}: ${stocks.length} stock items`);

              for (const stock of stocks) {
                const nmId = parseInt(stock.sku);
                if (!isNaN(nmId)) {
                  const current = stockMap.get(nmId) || 0;
                  stockMap.set(nmId, current + (stock.amount || 0));
                }
              }
            } else {
              const errorText = await stocksRes.text();
              console.warn(
                `⚠️ WB Stocks API error for wh ${wh.id}: ${stocksRes.status}`,
                errorText
              );
            }
          } catch (e) {
            console.warn(`⚠️ WB Stocks error for warehouse ${wh.id}:`, e);
          }
        }

        if (stockMap.size > 0) {
          console.log(
            `📦 WB FBS Stocks: Found stocks for ${stockMap.size} products across ${warehouses.length} warehouses`
          );
          return stockMap;
        } else {
          console.log(`📦 WB FBS: Warehouses exist but no stocks found`);
        }
      }
    } else {
      const errorText = await warehousesRes.text();
      console.warn(`⚠️ WB Warehouses API error: ${warehousesRes.status}`, errorText);
    }

    // Step 2: FBO fallback - use Statistics API for WB warehouse stocks
    console.log(`📦 WB: No FBS stocks, trying FBO via Statistics API...`);

    const today = new Date();
    const dateFrom = new Date(today);
    dateFrom.setDate(today.getDate() - 1); // Yesterday

    const fboRes = await fetchWithRetry(
      `https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    console.log(`📡 WB FBO Statistics API: status=${fboRes.status}`);

    if (fboRes.ok) {
      // FBO statistics often returns array of simple objects, let's define ad-hoc or allow any for now if structure is complex/unknown
      // But standard statistics API usually returns array of items with quantityFull
      const fboStocks = (await fboRes.json()) as WbStatisticsStock[];
      console.log(
        `📦 WB FBO API: Got ${Array.isArray(fboStocks) ? fboStocks.length : 0} stock items from Statistics API`
      );

      if (Array.isArray(fboStocks)) {
        // Group by nmId and sum quantities
        for (const item of fboStocks) {
          const nmId = item.nmId;
          if (nmId && nmIds.includes(nmId)) {
            const current = stockMap.get(nmId) || 0;
            // quantityFull = total on WB warehouses
            stockMap.set(nmId, current + (item.quantityFull || item.quantity || 0));
          }
        }

        console.log(
          `📦 WB FBO Stocks: Matched ${stockMap.size}/${fboStocks.length} items to our ${nmIds.length} products`
        );
      }
    } else {
      console.warn(`⚠️ WB Statistics API error: ${fboRes.status}`);
    }
  } catch (e) {
    console.error('❌ WB Stocks API error:', e);
  }

  return stockMap;
}

/**
 * Fetch products from WB Content API with REAL stocks
 */
export async function fetchWbProducts(apiKey: string, limit = 100): Promise<MarketplaceProduct[]> {
  // Step 1: Get product cards from Content API
  const cardsResponse = await fetchWithRetry(
    'https://content-api.wildberries.ru/content/v2/get/cards/list',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        settings: { cursor: { limit }, filter: { withPhoto: -1 } },
      }),
    }
  );

  if (!cardsResponse.ok) {
    throw new Error(`WB Content API error: ${cardsResponse.status}`);
  }

  const cardsData = (await cardsResponse.json()) as { cards: WbCard[] };

  const cards: WbCard[] = cardsData.cards || [];
  const nmIds = cards.map(card => card.nmID);

  // Step 2: Fetch REAL prices from Prices API
  const { priceMap } = await fetchWbPrices(apiKey, nmIds);

  // Step 3: Fetch REAL stocks from Warehouse Stocks API
  const stockMap = await fetchWbStocks(apiKey, nmIds);

  // Step 4: Map to unified format with estimated buyer price
  return cards.map(card => {
    const sellerPrice = priceMap.get(card.nmID) || 0;
    const { price: buyerPrice, discountPercent } = calculateWbBuyerPrice(sellerPrice);

    return {
      product_id: `wb-${card.nmID}`,
      nm_id: card.nmID,
      title: card.title || card.subjectName || 'Без названия',
      image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
      current_price: sellerPrice,
      estimated_buyer_price: buyerPrice,
      marketplace_discount_percent: discountPercent,
      current_stock: stockMap.get(card.nmID) || 0,
      marketplace: 'WB' as const,
    };
  });
}

/**
 * Fetch prices from WB Prices API
 * FIXED (Dec 2024): Always use bulk fetch to avoid rate limiting (429)
 * Previous implementation fetched individually causing 429 errors
 */
export async function fetchWbPrices(
  apiKey: string,
  nmIds: number[]
): Promise<{ priceMap: Map<number, number>; error?: string }> {
  const priceMap = new Map<number, number>();

  if (nmIds.length === 0) return { priceMap };

  try {
    // Step 1: Try Prices API first

    const url = new URL('https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter');
    url.searchParams.set('limit', '1000');
    url.searchParams.set('offset', '0');

    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: { Authorization: apiKey },
    });

    if (response.ok) {
      const data = (await response.json()) as { data: { listGoods: WbGoodsItem[] } };
      const goods = data.data?.listGoods || [];

      // CRITICAL FIX: Ensure all IDs are numbers (Postgres/JSON type mismatch)
      const requestedNmIds = new Set(nmIds.map(id => Number(id)));

      for (const good of goods) {
        const goodNmId = Number(good.nmID);
        if (nmIds.length === 0 || requestedNmIds.has(goodNmId)) {
          const price = extractWbPrice(good);
          if (price > 0) {
            priceMap.set(goodNmId, price);
          }
        }
      }
    } else {
      console.warn(`⚠️ WB Prices API error: ${response.status}`);
    }

    // Step 2: Statistics API fallback for missing prices
    const missing = nmIds.filter(id => !priceMap.has(id));
    if (missing.length > 0) {
      const today = new Date();
      const dateFrom = new Date(today);
      dateFrom.setDate(today.getDate() - 30); // Last 30 days

      try {
        const salesRes = await fetch(
          `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
          {
            method: 'GET',
            headers: { Authorization: apiKey },
          }
        );

        if (salesRes.ok) {
          const sales = (await salesRes.json()) as WbStatisticsSale[];
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

          const foundFromSales = missing.filter(id => priceMap.has(id)).length;
          if (foundFromSales > 0) {
            console.log(`💰 WB Statistics: Found ${foundFromSales} additional prices from sales`);
          }
        }
      } catch (e) {
        console.warn('⚠️ WB Statistics API fallback failed:', e);
      }
    }

    // Log final results
    const stillMissing = nmIds.filter(id => !priceMap.has(id));

    if (stillMissing.length > 0) {
      if (stillMissing.length <= 5) {
        console.warn(`⚠️ WB: Still missing prices for nmIDs: ${stillMissing.join(', ')}`);
      } else {
        console.warn(`⚠️ WB: Still missing prices for ${stillMissing.length} products`);
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
 * Extract price from WB goods item
 * Priority: discountedPrice > clubDiscountedPrice > salePrice > price
 * WB API v2 December 2024 Update: Prices can be in sizes[0] or direct.
 *
 * NOTE: WB API format is unclear - adding logging for diagnosis
 */
function extractWbPrice(good: WbGoodsItem): number {
  // Try sizes first (most accurate for v2)
  const size = good.sizes?.[0];
  let price = 0;

  if (size) {
    // Priority for final price to customer
    price = size.discountedPrice || size.clubDiscountedPrice || size.salePrice || size.price || 0;
  }

  // Fallback to top-level price if size price is missing
  if (price === 0) {
    price = (good as any).price || (good as any).discountedPrice || 0;
  }

  // Log for debugging (first 3 items only to avoid spam)
  if (good.nmID && price > 0) {
    console.log(`📊 WB Price Debug: nmId=${good.nmID}, raw_price=${price}`);
  }

  // Return as-is - WB API v2 appears to return prices in RUBLES
  return Math.round(price);
}

/**
 * Update prices on WB
 */
/**
 * Update prices on WB
 * CRITICAL FIX (Dec 2024 Audit):
 * - nmId → nmID (WB API requires uppercase ID)
 * - Added discount: 0 (required for task to execute)
 * - Returns taskId for status tracking
 * - Input validation for NaN/null prices
 */
export async function updateWbPrices(
  apiKey: string,
  updates: Array<{ nmId: number; price: number }>
): Promise<{ success: boolean; count: number; error?: string; taskId?: number }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  // Validate inputs - prevent NaN/null being sent to WB API
  const validUpdates = updates.filter(u => {
    const isValid =
      Number.isFinite(u.nmId) && u.nmId > 0 && Number.isFinite(u.price) && u.price > 0;
    if (!isValid) {
      console.warn(`⚠️ WB: Skipping invalid update - nmId: ${u.nmId}, price: ${u.price}`);
    }
    return isValid;
  });

  if (validUpdates.length === 0) {
    return { success: false, count: 0, error: 'Нет валидных товаров для обновления' };
  }

  // Batch limit: WB allows max 1000 items per request (TZ 2.0 readiness)
  if (validUpdates.length > 1000) {
    console.warn(`⚠️ WB: Truncating batch from ${validUpdates.length} to 1000 items`);
  }
  const batchedUpdates = validUpdates.slice(0, 1000);

  try {
    // WB API v2: Required fields are nmId, price, discount
    // NOTE: WB API v2/upload/task expects prices in RUBLES (confirmed)
    // Do NOT multiply by 100!
    const payload = batchedUpdates.map(u => ({
      nmId: Number(u.nmId),
      price: Math.round(u.price), // Price in RUBLES
      discount: 0, // Required field - 0 means no discount
    }));

    const response = await fetchWithRetry(
      'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: payload }),
      }
    );

    if (!response.ok) {
      console.log(`📡 WB Payload: ${JSON.stringify({ data: payload })}`);
    }

    if (response.ok) {
      const responseBody = (await response.json()) as WbUploadTaskResponse;

      if (responseBody.error || responseBody.errorText) {
        console.error(
          `❌ WB API Logical Error: ${responseBody.errorText || 'Unknown error'}`,
          `Payload: ${JSON.stringify({ data: payload })}`,
          `Response: ${JSON.stringify(responseBody)}`
        );
        return { success: false, count: 0, error: responseBody.errorText || 'Invalid format' };
      }

      const taskId = responseBody.data?.id;
      console.log(`📋 WB: Task created with ID: ${taskId} for ${batchedUpdates.length} items`);

      // Note: 200 OK means task is QUEUED, not completed!
      // Use checkWbTaskStatus() to verify actual execution
      return { success: true, count: batchedUpdates.length, taskId };
    } else {
      const errorText = await response.text();
      console.error(`❌ WB Price Update Failed: ${errorText}`);
      return { success: false, count: 0, error: errorText };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, count: 0, error };
  }
}

/**
 * Check WB price update task status
 * CRITICAL: WB API is asynchronous - 200 OK only means task is queued!
 * This function verifies actual execution status.
 *
 * Per Dec 2024 Audit recommendations from AI consilium.
 */
export async function checkWbTaskStatus(
  apiKey: string,
  taskId: number
): Promise<{
  completed: boolean;
  hasErrors: boolean;
  errors?: string[];
  status?: string;
}> {
  try {
    // WB provides task history endpoint
    const response = await fetchWithRetry(
      `https://discounts-prices-api.wildberries.ru/api/v2/history/tasks`,
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    if (!response.ok) {
      console.error(`❌ WB Task Status check failed: ${response.status}`);
      return { completed: false, hasErrors: true, errors: ['Failed to fetch task status'] };
    }

    const data = (await response.json()) as { data: WbTaskHistoryItem[] };
    const tasks: WbTaskHistoryItem[] = data.data || [];
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      console.log(`⏳ WB Task ${taskId} not found yet (may be processing)`);
      return { completed: false, hasErrors: false, status: 'processing' };
    }

    // Check for per-item errors in task details
    const details: WbTaskDetail[] = task.details || [];
    const failedItems = details.filter(d => d.status === 'rejected' || d.errorText);

    const errors = failedItems.map(e => `nmID ${e.nmID}: ${e.errorText || 'rejected'}`);

    const isCompleted = task.status === 'completed' || task.status === 'done';
    const hasErrors = failedItems.length > 0;

    console.log(`📋 WB Task ${taskId}: status=${task.status}, errors=${failedItems.length}`);

    return {
      completed: isCompleted,
      hasErrors,
      errors: hasErrors ? errors : undefined,
      status: task.status,
    };
  } catch (e) {
    console.error('❌ WB Task Status check error:', e);
    return {
      completed: false,
      hasErrors: true,
      errors: [e instanceof Error ? e.message : 'Unknown error'],
    };
  }
}

// ============================================
// OZON API
// ============================================

/**
 * Fetch products from Ozon API
 */
export async function fetchOzonProducts(
  clientId: string,
  apiKey: string,
  limit = 100
): Promise<MarketplaceProduct[]> {
  // Step 1: Get product list
  const listResponse = await fetchWithRetry('https://api-seller.ozon.ru/v3/product/list', {
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

  const listData = (await listResponse.json()) as { result: { items: OzonProductListItem[] } };

  const items = listData.result?.items || [];

  if (items.length === 0) return [];

  // Step 2: Get product details
  const productIds = items.map(item => item.product_id);
  const detailResponse = await fetchWithRetry('https://api-seller.ozon.ru/v3/product/info/list', {
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

  const detailData = (await detailResponse.json()) as {
    result: { items: OzonProductInfo[] };
    items?: OzonProductInfo[];
  };
  const detailItems: OzonProductInfo[] = detailData.result?.items || detailData.items || [];

  // Step 3: Map to unified format with estimated buyer price
  return detailItems.map(item => {
    const stocks: OzonStockItem[] = item.stocks?.stocks || [];
    const totalStock = stocks.reduce((acc, s) => acc + (s.present || 0), 0);

    let price = 0;
    if (typeof item.price === 'object' && item.price !== null) {
      price = parseFloat(item.price.marketing_price || item.price.price || '0');
    } else if (typeof item.price === 'string') {
      price = parseFloat(item.price || item.marketing_price || '0');
    }

    const roundedPrice = Math.round(price);

    // Calculate estimated buyer price (accounts for Ozon Card + typical discounts)
    // Since Ozon removed marketing_price from API (Nov 2025), we estimate
    const { price: buyerPrice, discountPercent } = calculateOzonBuyerPrice(roundedPrice);

    return {
      product_id: `ozon-${item.id}`,
      title: item.name || 'Без названия',
      image_url:
        (typeof item.primary_image === 'string'
          ? item.primary_image
          : (item.primary_image as string[])?.[0]) ||
        item.images?.[0] ||
        null,
      current_price: roundedPrice,
      estimated_buyer_price: buyerPrice,
      marketplace_discount_percent: discountPercent,
      current_stock: totalStock,
      marketplace: 'Ozon' as const,
    };
  });
}

/**
 * Update prices on Ozon
 * IMPROVED (Dec 2024 Audit):
 * - Added result.errors checking (Ozon can return 200 OK with per-item errors)
 * - Added input validation
 * - Returns partial success info
 */
export async function updateOzonPrices(
  clientId: string,
  apiKey: string,
  updates: Array<{ productId: number; price: number }>
): Promise<{ success: boolean; count: number; error?: string; partialErrors?: string[] }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  // Validate inputs
  const validUpdates = updates.filter(u => {
    const isValid =
      Number.isFinite(u.productId) && u.productId > 0 && Number.isFinite(u.price) && u.price > 0;
    if (!isValid) {
      console.warn(
        `⚠️ Ozon: Skipping invalid update - productId: ${u.productId}, price: ${u.price}`
      );
    }
    return isValid;
  });

  if (validUpdates.length === 0) {
    return { success: false, count: 0, error: 'Нет валидных товаров для обновления' };
  }

  // Batch limit: Ozon allows max 1000 items per request
  if (validUpdates.length > 1000) {
    console.warn(`⚠️ Ozon: Truncating batch from ${validUpdates.length} to 1000 items`);
  }
  const batchedUpdates = validUpdates.slice(0, 1000);

  try {
    const payload = {
      prices: batchedUpdates.map(u => ({
        product_id: u.productId,
        price: String(u.price),
        old_price: String(Math.round(u.price * 1.1)),
        currency_code: 'RUB',
      })),
    };

    console.log(`📤 Ozon Price Update: ${validUpdates.length} items`);

    const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/product/import/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const responseData = (await response.json()) as { result: OzonPriceUpdateResult[] };
      const results: OzonPriceUpdateResult[] = responseData.result || [];

      // Check for per-item errors (Ozon can return 200 OK with errors in result)
      const successfulUpdates = results.filter(r => r.updated === true);

      const failedUpdates = results.filter(
        r => r.updated === false || (r.errors && r.errors.length > 0)
      );

      if (failedUpdates.length > 0) {
        // Extract error messages
        const errorMessages = failedUpdates
          .flatMap(
            f =>
              f.errors?.map(
                (e: OzonError) => `product_id ${f.product_id}: ${e.message || e.code}`
              ) || [`product_id ${f.product_id}: update failed`]
          )
          .slice(0, 5); // Limit to first 5 errors

        console.warn(
          `⚠️ Ozon partial failure: ${failedUpdates.length} items failed`,
          errorMessages
        );

        // Partial success - some items updated, some failed
        if (successfulUpdates.length > 0) {
          return {
            success: true, // Partial success
            count: successfulUpdates.length,
            error: `${failedUpdates.length} товаров не обновлено`,
            partialErrors: errorMessages,
          };
        } else {
          return {
            success: false,
            count: 0,
            error: `Все ${failedUpdates.length} товаров не обновлены: ${errorMessages.join('; ')}`,
            partialErrors: errorMessages,
          };
        }
      }

      console.log(`✅ Ozon: Updated ${validUpdates.length} prices`);
      return { success: true, count: validUpdates.length };
    } else {
      const errorText = await response.text();
      console.error(`❌ Ozon Price Update Failed: ${errorText}`);
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
export async function fetchOzonSalesStats(
  clientId: string,
  apiKey: string,
  dateFrom: Date,
  dateTo: Date
): Promise<MarketplaceSalesStats | null> {
  try {
    const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/analytics/data', {
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
      const data = (await response.json()) as { result: { data: OzonAnalyticsRow[] } };

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
 * Get sales stats from WB
 */
export async function fetchWbSalesStats(
  apiKey: string,
  dateFrom: Date
): Promise<MarketplaceSalesStats | null> {
  try {
    const response = await fetchWithRetry(
      `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    if (response.ok) {
      const sales = (await response.json()) as WbStatisticsSale[];

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

// ============================================
// SENTINEL DEFENSE OPERATIONS
// ============================================

/**
 * Fetch current prices from Ozon for price monitoring
 * Uses v4/product/info/prices for accurate promotional prices
 */
export async function fetchOzonCurrentPrices(
  clientId: string,
  apiKey: string,
  productIds: number[]
): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();

  if (productIds.length === 0) return priceMap;

  // Sanitize and deduplicate IDs
  const validIds = Array.from(new Set(productIds.filter(id => typeof id === 'number' && id > 0)));

  if (validIds.length === 0) {
    console.warn('⚠️ Ozon: No valid numeric product IDs to fetch');
    return priceMap;
  }

  try {
    console.log(`📡 Ozon Prices API v5: Fetching for ${validIds.length} products`);

    // ⚠️ CRITICAL FIX: Ozon API v5 does NOT support product_id filter!
    // We must load ALL products and filter locally
    // Reference: Tested 2026-01-06 - filter returns empty result

    // Convert validIds to Set for O(1) lookup
    const requestedIds = new Set(validIds);

    // Load ALL prices (pagination support for large catalogs)
    let cursor = '';
    let totalFetched = 0;
    const MAX_PAGES = 10; // Safety limit
    let pageCount = 0;

    while (pageCount < MAX_PAGES) {
      pageCount++;

      const requestBody = {
        filter: {
          visibility: 'ALL',
        },
        cursor,
        limit: 1000, // Max allowed by Ozon
      };

      const response = await fetchWithRetry('https://api-seller.ozon.ru/v5/product/info/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Id': clientId,
          'Api-Key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error(`❌ Ozon Prices API v5 error: ${response.status}`);
        break;
      }

      const data = (await response.json()) as any;
      const items = data.items || data.result?.items || [];
      totalFetched += items.length;

      // Extract prices for requested products
      for (const p of items) {
        const pid = Number(p.product_id);
        if (requestedIds.has(pid)) {
          const priceObj = p.price || {};
          // Use 'price' field (actual selling price after discounts)
          const actualPrice = parseFloat(priceObj.price || priceObj.marketing_seller_price || '0');

          if (actualPrice > 0) {
            priceMap.set(pid, Math.round(actualPrice));
          }
        }
      }

      // Check if we got all requested IDs
      if (priceMap.size >= validIds.length) {
        console.log(`✅ Ozon: Found all ${priceMap.size} requested prices`);
        break;
      }

      // Check for next page
      const nextCursor = data.cursor || '';
      if (!nextCursor || nextCursor === cursor || items.length < 1000) {
        // No more pages
        break;
      }
      cursor = nextCursor;
    }

    console.log(
      `💰 Ozon Prices API v5: Fetched ${priceMap.size}/${validIds.length} prices (scanned ${totalFetched} total)`
    );

    // Log missing IDs for debugging
    const missing = validIds.filter(id => !priceMap.has(id));
    if (missing.length > 0 && missing.length <= 5) {
      console.warn(`⚠️ Ozon: Missing prices for IDs: ${missing.join(', ')}`);
    } else if (missing.length > 5) {
      console.warn(`⚠️ Ozon: Missing prices for ${missing.length} products`);
    }
  } catch (e) {
    console.warn('⚠️ Failed to fetch Ozon prices:', e);
  }

  return priceMap;
}

/**
 * Fetch product info from Ozon (for offer_id needed in defense actions)
 */
export async function fetchOzonProductInfo(
  clientId: string,
  apiKey: string,
  productIds: number[]
): Promise<Map<number, { offer_id: string; name: string }>> {
  const infoMap = new Map<number, { offer_id: string; name: string }>();

  if (productIds.length === 0) return infoMap;

  try {
    const response = await fetchWithRetry('https://api-seller.ozon.ru/v3/product/info/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({ product_id: productIds }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        result: { items: OzonProductInfo[] };
        items?: OzonProductInfo[];
      };
      const items = data.result?.items || data.items || [];

      for (const item of items) {
        if (item.id) {
          infoMap.set(item.id, {
            offer_id: item.offer_id || '',
            name: item.name || '',
          });
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Failed to fetch Ozon product info:', e);
  }

  return infoMap;
}

/**
 * Set Ozon product stock to zero (defense action)
 */
export async function setOzonZeroStock(
  clientId: string,
  apiKey: string,
  products: Array<{ productId: number; offerId: string }>
): Promise<{ success: boolean; error?: string }> {
  if (products.length === 0) {
    return { success: true };
  }

  try {
    const payload = {
      stocks: products.map(p => ({
        offer_id: p.offerId,
        product_id: p.productId,
        stock: 0,
      })),
    };

    const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/product/import/stocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ Ozon: Set zero stock for ${products.length} products`);
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
export async function setOzonDefensePrice(
  clientId: string,
  apiKey: string,
  products: Array<{ productId: number; offerId: string; price: number }>
): Promise<{ success: boolean; error?: string }> {
  if (products.length === 0) {
    return { success: true };
  }

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

    const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/product/import/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log(`✅ Ozon: Set defense price for ${products.length} products`);
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
 * Set WB product stock to zero on all warehouses (defense action)
 */
export async function setWbZeroStock(
  apiKey: string,
  skus: string[]
): Promise<{ success: boolean; error?: string }> {
  if (skus.length === 0) {
    return { success: true };
  }

  try {
    // First get warehouse IDs
    const warehousesRes = await fetchWithRetry(
      'https://marketplace-api.wildberries.ru/api/v3/warehouses',
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    if (!warehousesRes.ok) {
      return { success: false, error: 'Failed to fetch warehouses' };
    }

    const warehouses = (await warehousesRes.json()) as WbWarehouse[];

    // Zero stock on all warehouses for these SKUs
    for (const wh of warehouses || []) {
      await fetchWithRetry(`https://marketplace-api.wildberries.ru/api/v3/stocks/${wh.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          stocks: skus.map(sku => ({ sku, amount: 0 })),
        }),
      });
    }

    console.log(
      `✅ WB: Set zero stock for ${skus.length} SKUs on ${warehouses?.length || 0} warehouses`
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Set WB product price (defense action - price correction)
 */
export async function setWbDefensePrice(
  apiKey: string,
  products: Array<{ nmId: number; price: number }>
): Promise<{ success: boolean; error?: string }> {
  if (products.length === 0) {
    return { success: true };
  }

  try {
    const payload = {
      data: products.map(p => ({
        nmId: Number(p.nmId), // WB API requires lowercase 'nmId'
        // WB API v2/upload/task expects prices in RUBLES
        price: Math.round(p.price),
        discount: 0,
      })),
    };

    console.log(`📡 WB Defense Payload:`, JSON.stringify(payload));

    const response = await fetchWithRetry(
      'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    console.log(`📡 WB Defense Response (${response.status}):`, responseText);

    if (response.ok) {
      // Parse JSON to check for errors inside response
      try {
        const json = JSON.parse(responseText);
        // WB API may return 200 but with errors in the body
        if (json.error || json.errorText) {
          return { success: false, error: json.error || json.errorText };
        }
      } catch {
        // If not JSON, that's fine
      }
      console.log(`✅ WB: Set defense price for ${products.length} products`);
      return { success: true };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
      };
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// STOCK MANAGEMENT (FBS ONLY)
// ============================================

/**
 * Update WB stock for FBS products
 * NOTE: Only works for FBS (seller's warehouse), not FBO (WB's warehouse)
 *
 * WB API: POST /api/v3/stocks/{warehouseId}
 * Requires: warehouseId (supplier's warehouse ID)
 */
export async function updateWbStockFbs(
  apiKey: string,
  warehouseId: number,
  updates: Array<{ sku: string; amount: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  // Validate inputs
  const validUpdates = updates.filter(u => {
    const isValid = u.sku && Number.isFinite(u.amount) && u.amount >= 0;
    if (!isValid) {
      console.warn(`⚠️ WB Stock: Skipping invalid update - sku: ${u.sku}, amount: ${u.amount}`);
    }
    return isValid;
  });

  if (validUpdates.length === 0) {
    return { success: false, count: 0, error: 'Нет валидных данных для обновления' };
  }

  try {
    const payload = {
      stocks: validUpdates.map(u => ({
        sku: u.sku,
        amount: u.amount,
      })),
    };

    console.log(
      `📦 WB Stock Update (FBS): ${validUpdates.length} items for warehouse ${warehouseId}`
    );

    const response = await fetchWithRetry(
      `https://marketplace-api.wildberries.ru/api/v3/stocks/${warehouseId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      console.log(`✅ WB Stock: Updated ${validUpdates.length} FBS items`);
      return { success: true, count: validUpdates.length };
    } else {
      const errorData = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      const errorText = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`❌ WB Stock Update Failed: ${errorText}`);
      return { success: false, count: 0, error: errorText };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error(`❌ WB Stock Update Exception:`, error);
    return { success: false, count: 0, error };
  }
}

/**
 * Get WB FBS warehouses (supplier's warehouses)
 * Returns list of warehouses where seller can manage stock
 */
export async function getWbFbsWarehouses(
  apiKey: string
): Promise<{ warehouses: Array<{ id: number; name: string }>; error?: string }> {
  try {
    const response = await fetchWithRetry(
      'https://marketplace-api.wildberries.ru/api/v3/warehouses',
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    if (response.ok) {
      const data = (await response.json()) as WbWarehouse[];
      const warehouses = (data || []).map(w => ({
        id: w.id,
        name: w.name || `Склад ${w.id}`,
      }));
      console.log(`📦 WB: Found ${warehouses.length} FBS warehouses`);
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
 * Update Ozon stock for FBS products
 * NOTE: Only works for FBS scheme, not FBO (Ozon's warehouse)
 *
 * Ozon API: POST /v2/products/stocks
 */
export async function updateOzonStockFbs(
  clientId: string,
  apiKey: string,
  updates: Array<{ productId: number; offerId: string; stock: number; warehouseId?: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  // Validate inputs
  const validUpdates = updates.filter(u => {
    const isValid = u.productId > 0 && Number.isFinite(u.stock) && u.stock >= 0;
    if (!isValid) {
      console.warn(
        `⚠️ Ozon Stock: Skipping invalid update - productId: ${u.productId}, stock: ${u.stock}`
      );
    }
    return isValid;
  });

  if (validUpdates.length === 0) {
    return { success: false, count: 0, error: 'Нет валидных данных для обновления' };
  }

  try {
    const payload = {
      stocks: validUpdates.map(u => ({
        offer_id: u.offerId,
        product_id: u.productId,
        stock: u.stock,
        ...(u.warehouseId && { warehouse_id: u.warehouseId }),
      })),
    };

    console.log(`📦 Ozon Stock Update (FBS): ${validUpdates.length} items`);

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
      const responseData = (await response.json()) as { result: OzonPriceUpdateResult[] };
      const results = responseData.result || [];

      // Check for per-item errors
      const failedItems = results.filter(r => r.updated === false || (r.errors?.length ?? 0) > 0);

      if (failedItems.length > 0) {
        console.warn(`⚠️ Ozon Stock: ${failedItems.length} items failed`);
        if (failedItems.length === validUpdates.length) {
          return { success: false, count: 0, error: 'Все обновления не удались' };
        }
        return {
          success: true,
          count: validUpdates.length - failedItems.length,
          error: `Частично: ${failedItems.length} ошибок`,
        };
      }

      console.log(`✅ Ozon Stock: Updated ${validUpdates.length} FBS items`);
      return { success: true, count: validUpdates.length };
    } else {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string };
      const errorText = errorData.message || `HTTP ${response.status}`;
      console.error(`❌ Ozon Stock Update Failed: ${errorText}`);
      return { success: false, count: 0, error: errorText };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    console.error(`❌ Ozon Stock Update Exception:`, error);
    return { success: false, count: 0, error };
  }
}

/**
 * Get Ozon FBS warehouses
 */
export async function getOzonFbsWarehouses(
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
      const data = (await response.json()) as { result: OzonWarehouse[] };
      const warehouses = (data.result || []).map(w => ({
        id: w.warehouse_id,
        name: w.name || `Склад ${w.warehouse_id}`,
      }));
      console.log(`📦 Ozon: Found ${warehouses.length} warehouses`);
      return { warehouses };
    } else {
      const errorText = await response.text();
      return { warehouses: [], error: errorText };
    }
  } catch (e) {
    return { warehouses: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

// ============================================
// SALES HISTORY SYNC (Dec 2024)
// ============================================

/**
 * Sync sales history from marketplaces to local DB
 * Creates a permanent record of orders for accurate analytics
 */
export async function syncSalesHistory(
  userId: number,
  daysBack: number = 30,
  accountId?: number
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    const keys = await getMarketplaceKeys(userId, accountId);
    let totalImported = 0;
    const orders: MarketplaceOrder[] = [];

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);

    // 1. Fetch WB Orders
    if (keys.wb) {
      try {
        const wbOrders = await fetchWbOrders(keys.wb, dateFrom);
        const mappedWb = wbOrders
          .filter(o => o.nmId && (o.srid || o.saleID))
          .map(o => ({
            order_id: o.srid || o.saleID || 'unknown', // Unique sale ID
            user_id: userId,
            marketplace_product_id: String(o.nmId),
            title: o.subject || `Товар ${o.nmId}`,
            marketplace: 'WB' as const,
            order_date: new Date(o.date || 0),
            status:
              (o.saleID && o.saleID.startsWith('R')) || o.isStorned ? 'returned' : 'delivered',
            price_total: o.finishedPrice || o.priceWithDisc || 0,
            quantity: 1, // Sales API returns single items
            commission: 0, // TODO: Calculate from report or use defaults
            logistics: 0, // TODO: Calculate from report
            cost_price: 0, // Will be filled from products table join later
            region: o.regionName || null,
            account_id: accountId || null,
          }));
        orders.push(...mappedWb);
        console.log(`📥 Sync: Fetched ${mappedWb.length} WB orders`);
      } catch (e) {
        console.warn('⚠️ Sync: Failed to fetch WB orders:', e);
      }
    }

    // 2. Fetch Ozon Orders (FBO + FBS)
    if (keys.ozon) {
      try {
        const ozonOrders = await fetchOzonOrders(keys.ozon.clientId, keys.ozon.apiKey, dateFrom);
        const mappedOzon = ozonOrders.map(o => ({
          order_id: o.posting_number,
          user_id: userId,
          marketplace_product_id: String(o.products?.[0]?.sku || o.products?.[0]?.offer_id),
          title: o.products?.[0]?.name || 'Ozon Product',
          marketplace: 'Ozon' as const,
          order_date: new Date(o.in_process_at || o.created_at),
          status: o.status,
          price_total: parseFloat(o.financial_data?.products?.[0]?.price || '0'),
          quantity: o.products?.[0]?.quantity || 1,
          commission: parseFloat(o.financial_data?.products?.[0]?.commission_amount || '0'),
          logistics: 0, // Ozon calculates this separately
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
    return { success: false, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Fetch raw WB sales data
 */
export async function fetchWbOrders(apiKey: string, dateFrom: Date) {
  const response = await fetchWithRetry(
    `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
    {
      method: 'GET',
      headers: { Authorization: apiKey },
    }
  );

  if (response.ok) {
    const data = (await response.json()) as WbStatisticsSale[];
    if (Array.isArray(data)) {
      return data;
    }
  } else {
    const txt = await response.text();
    console.warn(`WB Statistics API error: ${response.status} ${txt}`);
  }

  return [];
}

/**
 * Fetch raw Ozon orders (FBO + FBS)
 */
export async function fetchOzonOrders(clientId: string, apiKey: string, dateFrom: Date) {
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

/**
 * Fetch raw Ozon FBS UNFULFILLED orders
 */
export async function fetchOzonFbsUnfulfilledOrders(clientId: string, apiKey: string) {
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
      const data = (await response.json()) as { result: { postings: OzonOrder[] } };
      return data.result?.postings || [];
    }
  } catch (e) {
    console.error('Ozon unfulfilled error:', e);
  }
  return [];
}

/**
 * Fetch Ozon stocks using v3 API (Warehouse stocks)
 */
export async function fetchOzonStocksV3(clientId: string, apiKey: string, limit = 100) {
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
      const data = (await response.json()) as OzonStockV3Response;
      return data.result?.items || [];
    }
  } catch (e) {
    console.error('Ozon V3 stocks error:', e);
  }
  return [];
}

/**
 * Fetch Ozon analytics data
 */
export async function fetchOzonAnalytics(
  clientId: string,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  metrics: string[] = ['revenue', 'ordered_units', 'returns']
) {
  try {
    const response = await fetchWithRetry('https://api-seller.ozon.ru/v1/analytics/data', {
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
      const data = (await response.json()) as { result: { data: OzonAnalyticsRow[] } };
      return data.result?.data || [];
    }
  } catch (e) {
    console.error('Ozon analytics error:', e);
  }
  return [];
}
