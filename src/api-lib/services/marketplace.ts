// ============================================
// NeuroGUARDIAN — Marketplace Service
// Unified API client for WB and Ozon
// Single Source of Truth for marketplace operations
// ============================================

import { decryptApiKey, fetchWithRetry } from '../lib/index.js';
import { getUserById } from './database.js';
import type {
  WbCard,
  WbGoodsItem,
  WbTaskHistoryItem,
  WbTaskDetail,
  OzonProductInfo,
  OzonStockItem,
  OzonPriceUpdateResult,
  OzonError,
} from '../lib/marketplace-types.js';

// ============================================
// TYPES
// ============================================

export interface MarketplaceProduct {
  product_id: string;
  nm_id?: number;
  title: string;
  image_url: string | null;
  current_price: number;
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
// API KEY HELPERS
// ============================================

/**
 * Get decrypted marketplace API keys for a user
 */
export async function getMarketplaceKeys(userId: number): Promise<MarketplaceApiKeys> {
  const user = await getUserById(userId);
  if (!user) return {};

  const result: MarketplaceApiKeys = {};

  if (user.api_key_wb) {
    const decrypted = decryptApiKey(user.api_key_wb);
    if (decrypted) {
      result.wb = decrypted;
    }
  }

  if (user.api_key_ozon) {
    const decrypted = decryptApiKey(user.api_key_ozon);
    if (decrypted) {
      const [clientId, apiKey] = decrypted.split(':');
      if (clientId && apiKey) {
        result.ozon = { clientId, apiKey };
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
    const warehousesRes = await fetch('https://marketplace-api.wildberries.ru/api/v3/warehouses', {
      method: 'GET',
      headers: { Authorization: apiKey },
    });

    console.log(`📡 WB Warehouses API: status=${warehousesRes.status}`);

    if (warehousesRes.ok) {
      const warehouses = await warehousesRes.json();
      console.log(
        `📦 WB FBS: Found ${Array.isArray(warehouses) ? warehouses.length : 0} warehouses`
      );

      if (Array.isArray(warehouses) && warehouses.length > 0) {
        // Log warehouse names
        console.log(
          `📦 WB Warehouses: ${warehouses.map((w: { id: number; name?: string }) => `${w.name || w.id}`).join(', ')}`
        );

        // FBS mode - get stocks from seller's warehouses
        // Prepare SKUs from nmIds (WB uses nmId as SKU string)
        const skus = nmIds.map(id => String(id));
        console.log(`📦 WB: Will request stocks for ${skus.length} SKUs`);

        for (const wh of warehouses) {
          try {
            console.log(
              `🔍 WB: Fetching stocks for warehouse ${wh.id} (${wh.name || 'unnamed'})...`
            );
            const stocksRes = await fetch(
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
              const stocksData = await stocksRes.json();
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

    const fboRes = await fetch(
      `https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
      {
        method: 'GET',
        headers: { Authorization: apiKey },
      }
    );

    console.log(`📡 WB FBO Statistics API: status=${fboRes.status}`);

    if (fboRes.ok) {
      const fboStocks = await fboRes.json();
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
  const cardsResponse = await fetch(
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

  const cardsData = await cardsResponse.json();

  const cards: WbCard[] = cardsData.cards || [];
  const nmIds = cards.map(card => card.nmID);

  // Step 2: Fetch REAL prices from Prices API
  const { priceMap } = await fetchWbPrices(apiKey, nmIds);

  // Step 3: Fetch REAL stocks from Warehouse Stocks API
  const stockMap = await fetchWbStocks(apiKey, nmIds);

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
    console.log(`📡 WB Prices API: bulk fetch for ${nmIds.length} products`);

    const url = new URL('https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter');
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
          const price = extractWbPrice(good);
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
          `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom.toISOString().split('T')[0]}`,
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
    const foundCount = priceMap.size;
    const stillMissing = nmIds.filter(id => !priceMap.has(id));

    if (stillMissing.length > 0) {
      if (stillMissing.length <= 5) {
        console.warn(`⚠️ WB: Still missing prices for nmIDs: ${stillMissing.join(', ')}`);
      } else {
        console.warn(`⚠️ WB: Still missing prices for ${stillMissing.length} products`);
      }
    }

    console.log(`💰 WB: Extracted ${foundCount}/${nmIds.length} prices total`);
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
 */
function extractWbPrice(good: WbGoodsItem): number {
  const size = good.sizes?.[0];
  let price = 0;

  if (size) {
    // WB API 2024: prices are in RUBLES (not kopecks!)
    price =
      size.discountedPrice ||
      size.clubDiscountedPrice ||
      size.salePrice ||
      size.price ||
      good.price ||
      0;

    // Safety check: if price looks like kopecks (very high value), convert
    if (price > 100000) {
      price = Math.round(price / 100);
    }
  }

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

  // Batch limit: WB allows max 200 items per request
  if (validUpdates.length > 200) {
    console.warn(`⚠️ WB: Truncating batch from ${validUpdates.length} to 200 items`);
  }
  const batchedUpdates = validUpdates.slice(0, 200);

  try {
    // CRITICAL FIX: nmID (not nmId) + discount: 0
    const payload = {
      data: batchedUpdates.map(u => ({
        nmID: u.nmId, // WB API requires uppercase ID
        price: u.price,
        discount: 0, // Required for proper execution
      })),
    };

    console.log(
      `📤 WB Price Update: ${batchedUpdates.length} items, payload sample:`,
      JSON.stringify(payload.data.slice(0, 2))
    );

    const response = await fetchWithRetry(
      'https://discounts-prices-api.wildberries.ru/api/v2/upload/task',
      {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const responseBody = await response.json();

      if (responseBody.error) {
        console.error(
          `❌ WB API Logical Error: ${responseBody.errorText}`,
          JSON.stringify(responseBody)
        );
        return { success: false, count: 0, error: responseBody.errorText };
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

    const data = await response.json();
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
  const listResponse = await fetch('https://api-seller.ozon.ru/v3/product/list', {
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
  const detailResponse = await fetch('https://api-seller.ozon.ru/v3/product/info/list', {
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

  try {
    const payload = {
      prices: validUpdates.map(u => ({
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
      const responseData = await response.json();
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

  try {
    console.log(`📡 Ozon Prices API: Fetching for ${productIds.length} products`);

    // CRITICAL FIX: Use v2 endpoint (v4 returns 404)
    const response = await fetchWithRetry('https://api-seller.ozon.ru/v2/product/info/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        filter: { product_id: productIds },
        limit: 1000,
      }),
    });

    console.log(`📡 Ozon Prices API: status=${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const items = data.result?.items || [];

      console.log(`📦 Ozon Prices API: received ${items.length} items`);

      for (const p of items) {
        // Use marketing_price (actual selling price) or price
        const actualPrice = parseFloat(p.price?.marketing_price || p.price?.price || '0');
        if (p.product_id && actualPrice > 0) {
          priceMap.set(p.product_id, actualPrice);
        } else {
          console.warn(
            `⚠️ Ozon: No price for product ${p.product_id}, price object:`,
            JSON.stringify(p.price)
          );
        }
      }
      console.log(`💰 Ozon Prices API: Fetched ${priceMap.size}/${items.length} valid prices`);
    } else {
      const errorText = await response.text();
      console.error(`❌ Ozon Prices API error: ${response.status}`, errorText);
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
      const data = await response.json();
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

    const warehouses = await warehousesRes.json();

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
        nmID: p.nmId,
        price: p.price,
        discount: 0,
      })),
    };

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

    if (response.ok) {
      console.log(`✅ WB: Set defense price for ${products.length} products`);
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText };
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
      const errorData = await response.json().catch(() => ({}));
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
      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const warehouses = (data || []).map((w: any) => ({
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
      const responseData = await response.json();
      const results = responseData.result || [];

      // Check for per-item errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const failedItems = results.filter((r: any) => r.updated === false || r.errors?.length > 0);

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
      const errorData = await response.json().catch(() => ({}));
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
      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const warehouses = (data.result || []).map((w: any) => ({
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
