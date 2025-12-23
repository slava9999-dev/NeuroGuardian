// ============================================
// NeuroGUARDIAN — Marketplace Service
// Unified API client for WB and Ozon
// Single Source of Truth for marketplace operations
// ============================================

import { decryptApiKey, fetchWithRetry } from '../lib/index.js';
import { getUserById } from './database.js';

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
 * Fetch products from WB Content API
 */
export async function fetchWbProducts(apiKey: string, limit = 100): Promise<MarketplaceProduct[]> {
  // Step 1: Get product cards
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

  const cards = cardsData.cards || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nmIds = cards.map((card: any) => card.nmID);

  // Step 2: Fetch prices
  const priceMap = await fetchWbPrices(apiKey, nmIds);

  // Step 3: Map to unified format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cards.map((card: any) => ({
    product_id: `wb-${card.nmID}`,
    nm_id: card.nmID,
    title: card.title || card.subjectName || 'Без названия',
    image_url: card.photos?.[0]?.big || card.photos?.[0]?.c246x328 || null,
    current_price: priceMap.get(card.nmID) || 0,
    current_stock:
      card.sizes?.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sum: number, s: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sum + (s.stocks?.reduce((ss: number, st: any) => ss + st.qty, 0) || 0),
        0
      ) || 0,
    marketplace: 'WB' as const,
  }));
}

/**
 * Fetch prices from WB Prices API
 */
export async function fetchWbPrices(apiKey: string, nmIds: number[]): Promise<Map<number, number>> {
  const priceMap = new Map<number, number>();

  if (nmIds.length === 0) return priceMap;

  try {
    const pricesResponse = await fetch(
      'https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify({ limit: 1000, offset: 0, filterNmID: nmIds }),
      }
    );

    if (pricesResponse.ok) {
      const pricesData = await pricesResponse.json();
      const goods = pricesData.data?.listGoods || [];

      console.log(`📦 WB Prices API: received ${goods.length} goods`);

      for (const good of goods) {
        const size = good.sizes?.[0];
        let price = 0;

        if (size) {
          // Priority: discountedPrice > clubDiscountedPrice > salePrice > price
          // WB API 2024: prices are in RUBLES (not kopecks!)
          price =
            size.discountedPrice ||
            size.clubDiscountedPrice ||
            size.salePrice ||
            size.price ||
            good.price ||
            0;

          // Safety check: if price looks like kopecks, convert
          if (price > 100000) {
            price = Math.round(price / 100);
          }
        }

        if (price > 0) {
          priceMap.set(good.nmID, Math.round(price));
        } else {
          console.warn(`⚠️ WB: Zero price for nmID=${good.nmID}`);
        }
      }

      console.log(`💰 WB: Extracted prices for ${priceMap.size}/${goods.length} goods`);
    } else {
      console.error(`❌ WB Prices API error: ${pricesResponse.status}`);
    }
  } catch (e) {
    console.warn('Failed to fetch WB prices:', e);
  }

  return priceMap;
}

/**
 * Update prices on WB
 */
export async function updateWbPrices(
  apiKey: string,
  updates: Array<{ nmId: number; price: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const payload = {
      data: updates.map(u => ({ nmId: u.nmId, price: u.price })),
    };

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
      console.log(`✅ WB: Updated ${updates.length} prices`);
      return { success: true, count: updates.length };
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
  const detailItems = detailData.result?.items || detailData.items || [];

  // Step 3: Map to unified format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return detailItems.map((item: any) => {
    const totalStock =
      item.stocks?.stocks?.reduce((acc: number, s: any) => acc + (s.present || 0), 0) || 0;

    let price = 0;
    if (typeof item.price === 'object' && item.price !== null) {
      price = parseFloat(item.price.marketing_price || item.price.price || '0');
    } else {
      price = parseFloat(item.price || item.marketing_price || '0');
    }

    return {
      product_id: `ozon-${item.id}`,
      title: item.name || 'Без названия',
      image_url:
        (typeof item.primary_image === 'string' ? item.primary_image : item.primary_image?.[0]) ||
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
export async function updateOzonPrices(
  clientId: string,
  apiKey: string,
  updates: Array<{ productId: number; price: number }>
): Promise<{ success: boolean; count: number; error?: string }> {
  if (updates.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const payload = {
      prices: updates.map(u => ({
        product_id: u.productId,
        price: String(u.price),
        old_price: String(Math.round(u.price * 1.1)),
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
      console.log(`✅ Ozon: Updated ${updates.length} prices`);
      return { success: true, count: updates.length };
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
