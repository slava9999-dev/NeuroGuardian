// ============================================
// NeuroGUARDIAN — Competitor Monitor Service
// Real-time price fetching from external marketplaces
// Version: 1.1.0 | Date: 2026-01-03
// ============================================

import { getSecret } from '../lib/secrets-helper.js';

interface CompetitorData {
  nmId: number;
  price: number; // Текущая цена продажи (со всеми скидками)
  basicPrice: number; // Цена до скидок (для аналитики)
  available: boolean; // Есть ли в наличии
  stock: number; // Остаток (приблизительно)
}

/**
 * Извлекает nm_id из URL Wildberries
 * Примеры:
 * - https://www.wildberries.ru/catalog/123456789/detail.aspx → 123456789
 * - https://wildberries.ru/catalog/123456789 → 123456789
 * - wildberries.ru/catalog/123456789/detail.aspx?targetUrl=... → 123456789
 */
export function extractNmIdFromUrl(input: string | number): number | null {
  // If already a number, return it
  if (typeof input === 'number') return input;

  // If it's a pure number string
  if (/^\d{6,12}$/.test(String(input).trim())) {
    return parseInt(String(input).trim());
  }

  // Try to extract from WB/Ozon URL patterns
  const patterns = [
    // Wildberries
    /wildberries\.ru\/catalog\/(\d+)/i,
    /wb\.ru\/catalog\/(\d+)/i,
    /wbx\.ru\/(\d+)/i,
    /card\.wb\.ru\/.*nm=(\d+)/i,
    // Ozon
    /ozon\.ru\/product\/.*-(\d+)\//i,
    /ozon\.ru\/product\/(\d+)\//i,
    /ozon\.ru\/product\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = String(input).match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }

  // Last resort: find any sequence of 6-12 digits (likely nm_id or Ozon SKU)
  const digits = String(input).match(/\d{6,12}/);
  if (digits) {
    return parseInt(digits[0]);
  }

  return null;
}

/**
 * Fetches real-time data for a Wildberries competitor product
 * Uses public API used by WB mobile app/website
 */
export async function fetchWbCompetitorData(nmId: number | string): Promise<CompetitorData | null> {
  // WB API Endpoint (dest=-1257786 is Moscow default)
  // v4 is the current version as of 2026
  const url = `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nmId}`;

  let retries = 3;
  let response: Response | null = null;

  while (retries >= 0) {
    try {
      const currentResponse = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      response = currentResponse;

      if (response.status === 429 && retries > 0) {
        const wait = 2000 * (3 - retries + 1);
        console.warn(`[CompetitorMonitor] WB 429 Rate Limit hit. Retrying in ${wait}ms...`);
        await new Promise(resolve => setTimeout(resolve, wait));
        retries--;
        continue;
      }

      if (response.status >= 500 && retries > 0) {
        console.warn(`[CompetitorMonitor] WB ${response.status} Error. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }

      break; // Success or out of retries with a non-retryable error
    } catch (error) {
      if (retries > 0) {
        console.warn('[CompetitorMonitor] Network error, retrying...', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }
      throw error;
    }
  }

  try {
    if (!response || !response.ok) {
      throw new Error(`WB API Error: ${response?.status} ${response?.statusText}`);
    }

    interface WbPriceV4 {
      basic: number;
      product: number;
      total?: number;
    }

    interface WbSizeV4 {
      price?: WbPriceV4;
      stocks?: Array<{ qty: number }>;
    }

    interface WbProductV4 {
      priceU?: number; // Legacy/fallback
      salePriceU?: number; // Legacy/fallback
      sizes?: WbSizeV4[];
    }

    const rawData = await response.json();
    // Support both { data: { products: [...] } } and { products: [...] }
    const products = (rawData.data?.products || rawData.products) as WbProductV4[];

    if (!products?.length) {
      console.warn(`Competitor monitor: Product ${nmId} not found on WB (Empty products array)`);
      return null;
    }

    const product = products[0];

    // v4 logic: price is inside sizes
    const firstSizeWithPrice = product.sizes?.find((s: WbSizeV4) => s.price);
    const priceObj = firstSizeWithPrice?.price;

    // Prices are in kopecks (cents), so divide by 100
    // product - цена после скидки продавца
    // basic - базовая цена
    let finalPrice = 0;
    let basicPrice = 0;

    if (priceObj) {
      finalPrice = (priceObj.product || priceObj.basic || 0) / 100;
      basicPrice = (priceObj.basic || priceObj.product || 0) / 100;
    } else {
      // Fallback to legacy fields if v4 structure is missing but fields remain
      finalPrice = ((product.salePriceU || product.priceU) ?? 0) / 100;
      basicPrice = ((product.priceU || product.salePriceU) ?? 0) / 100;
    }

    // Calculate total stock across all sizes/warehouses
    let totalStock = 0;
    if (product.sizes) {
      for (const size of product.sizes) {
        if (size.stocks) {
          for (const stock of size.stocks) {
            totalStock += stock.qty || 0;
          }
        }
      }
    }

    return {
      nmId: Number(nmId),
      price: finalPrice,
      basicPrice: basicPrice,
      available: totalStock > 0,
      stock: totalStock,
    };
  } catch (error) {
    console.error(`Failed to fetch WB competitor ${nmId}:`, error);
    return null;
  }
}

/**
 * Fetches data for Ozon competitor
 * NOTE: Ozon does not have a public stable API for scraping without heavy protection.
 * For v3.0 we explicitly verify if we can fetch it, if not - return error.
 */
export async function fetchOzonCompetitorData(productId: string): Promise<CompetitorData | null> {
  // Ozon Direct API is not publicly available without specialized enterprise access.
  // CYBER-SURGEON IMPL: Use Google Serper API to find price in rich snippets

  try {
    const serperKey = await getSecret('serper_api_key', 'competitor_monitor');
    if (!serperKey) {
      console.warn('⚠️ Ozon Monitor: SERPER_API_KEY missing, cannot fetch Ozon prices');
      return null;
    }

    // Search query: "ozon [id] цена" - highly likely to return product card
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `site:ozon.ru/product ${productId}`,
        gl: 'ru',
        hl: 'ru',
        num: 3,
      }),
    });

    if (!response.ok) return null;

    interface OzonSerperResult {
      link?: string;
      title?: string;
      snippet?: string;
    }

    const data = (await response.json()) as { organic?: OzonSerperResult[] };
    const ozonResult = data.organic?.find(r => r.link?.includes('ozon.ru'));

    if (!ozonResult || (!ozonResult.snippet && !ozonResult.title)) return null;

    // Smart Price Regex (Tested)
    const textToCheck = (ozonResult.title + ' ' + ozonResult.snippet).toLowerCase();

    // Pattern: 1 234 ₽, 1.234 руб (remove dots/commas to handle thousands)
    const currencyMatch = textToCheck.match(/(\d[\d\s.,]*)\s*(?:₽|руб|rur)/i);
    const priceLabelMatch = textToCheck.match(/цена\s*:?\s*(\d[\d\s.,]*)/i);
    const match = currencyMatch || priceLabelMatch;

    if (match && match[1]) {
      const raw = match[1].replace(/[\s,.]/g, ''); // 5.990 -> 5990
      const price = Math.round(parseFloat(raw));

      if (price > 0 && price < 1000000) {
        // Sanity check
        return {
          nmId: Number(productId), // using nmId field as generic ID holder
          price: price,
          basicPrice: price, // Can't get basic price from snippet reliably
          available: true, // If it's in snippet, it's likely indexed & available
          stock: 100, // Dummy stock for availability
        };
      }
    }
  } catch (error) {
    console.error(`Failed to fetch Ozon competitor ${productId} via Serper:`, error);
  }

  return null;
}

/**
 * Main entry point to get competitor price (routing by marketplace)
 */
export async function getCompetitorPrice(
  marketplace: 'WB' | 'Ozon',
  identifier: string | number
): Promise<number | null> {
  if (marketplace === 'WB') {
    const data = await fetchWbCompetitorData(identifier);
    return data && data.available ? data.price : null;
  } else if (marketplace === 'Ozon') {
    const data = await fetchOzonCompetitorData(String(identifier));
    return data && data.available ? data.price : null;
  }
  return null;
}
