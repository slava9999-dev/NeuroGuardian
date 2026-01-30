import { eq } from 'drizzle-orm';
import { db, products } from '../../infrastructure/database/db.js';
import { fetchWithRetry } from '../lib/index.js';
import { logger } from '../lib/logger.js';

export interface RealPriceInfo {
  marketplace: 'wb' | 'ozon';
  productId: string; // SKU/Article
  title?: string;
  sellerPrice: number; // The base price set by seller (before SPP)
  buyerPrice: number; // The final price for the client
  cardPrice?: number; // Ozon Card / WB Wallet price
  currency: string;
  rating?: number;
  reviewCount?: number;
  error?: string;
  raw?: unknown; // Raw data for debugging
  extractionMethod?: string;
}

export class PriceParserService {
  /**
   * Get Real Buyer Price from Wildberries (Public Mobile API)
   */
  async getWbRealPrice(
    article: string | number,
    options: { skipBrowserEyes?: boolean } = {}
  ): Promise<RealPriceInfo> {
    const nmId = Number(article);
    const nmIdStr = String(article);

    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    const basketHost = this.getWbBasketHost(vol);
    const staticCardUrl = `https://${basketHost}/vol${vol}/part${part}/${nmId}/info/ru/card.json`;

    const dynamicUrls = [
      `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nmIdStr}`,
      `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&nm=${nmIdStr}`,
    ];

    let productTitle = `Товар ${nmIdStr}`;
    let sellerPrice = 0;
    let buyerPrice = 0;
    const currency = 'RUB';
    const rating = 0;
    const reviewCount = 0;
    let found = false;
    const errorMsg = '';

    // Step A: Digital Vision
    if (!options.skipBrowserEyes) {
      try {
        const { browserEyes } = await import('../../sentinel/BrowserEyes.js');
        const url = `https://www.wildberries.ru/catalog/${nmIdStr}/detail.aspx`;
        const result = await browserEyes.gazeAtProduct('WB', url);
        if (result.buyerPrice && result.buyerPrice > 0) {
          return {
            marketplace: 'wb',
            productId: nmIdStr,
            title: productTitle,
            sellerPrice: result.originalPrice || result.buyerPrice,
            buyerPrice: result.buyerPrice,
            currency,
            extractionMethod: 'vision',
          };
        }
      } catch (e) {
        logger.warn(`[PriceParser] WB Vision failed for ${nmIdStr}`);
      }
    }

    // Step B: API
    for (const url of dynamicUrls) {
      try {
        const res = await fetchWithRetry(
          url,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          },
          1
        );

        if (res.ok) {
          const data = await res.json();
          const p = data.data?.products?.[0] || data.products?.[0];
          if (p) {
            const size = p.sizes?.[0];
            if (size && size.price) {
              sellerPrice = Math.round((size.price.basic || 0) / 100);
              buyerPrice = Math.round((size.price.product || size.price.total || 0) / 100);
              productTitle = p.name || productTitle;
              found = true;
              break;
            }
          }
        }
      } catch {}
    }

    // Fallback Result
    return {
      marketplace: 'wb',
      productId: nmIdStr,
      title: productTitle,
      sellerPrice: sellerPrice || buyerPrice || 0,
      buyerPrice: buyerPrice || 0,
      currency,
      error: buyerPrice === 0 ? 'Failed to fetch price' : undefined,
    };
  }

  /**
   * Get Real Buyer Price from Ozon
   */
  async getOzonRealPrice(
    sku: string,
    options: { skipBrowserEyes?: boolean } = {}
  ): Promise<RealPriceInfo> {
    const url = `https://www.ozon.ru/product/${sku}/`;

    // Step A: Digital Vision
    if (!options.skipBrowserEyes) {
      try {
        const { browserEyes } = await import('../../sentinel/BrowserEyes.js');
        const result = await browserEyes.gazeAtProduct('Ozon', url);
        if (result.buyerPrice && result.buyerPrice > 0) {
          return {
            marketplace: 'ozon',
            productId: sku,
            sellerPrice: result.originalPrice || result.buyerPrice,
            buyerPrice: result.buyerPrice,
            currency: 'RUB',
            extractionMethod: 'vision',
          };
        }
      } catch (e) {
        logger.warn(`[PriceParser] Ozon Vision failed for ${sku}`);
      }
    }

    // Step B: Social Crawler Fallback
    try {
      const socialResponse = await fetch(url, {
        headers: { 'User-Agent': 'WhatsApp/2.21.12.21 A' },
      });
      if (socialResponse.ok) {
        const html = await socialResponse.text();
        // Stricter price extraction from Ozon HTML metadata
        const priceMatch =
          html.match(/"price":\s*"(\d+)"/) ||
          html.match(/"finalPrice":\s*(\d+)/) ||
          html.match(/"price":\s*(\d+)/);
        if (priceMatch) {
          const price = parseInt(priceMatch[1]);
          return {
            marketplace: 'ozon',
            productId: sku,
            sellerPrice: price,
            buyerPrice: price,
            currency: 'RUB',
            extractionMethod: 'social_crawler',
          };
        }
      }
    } catch {}

    return {
      marketplace: 'ozon',
      productId: sku,
      sellerPrice: 0,
      buyerPrice: 0,
      currency: 'RUB',
      error: 'All Ozon endpoints failed',
    };
  }

  private getWbBasketHost(vol: number): string {
    if (vol <= 143) return 'basket-01.wbbasket.ru';
    if (vol <= 287) return 'basket-02.wbbasket.ru';
    if (vol <= 431) return 'basket-03.wbbasket.ru';
    if (vol <= 719) return 'basket-04.wbbasket.ru';
    if (vol <= 1007) return 'basket-05.wbbasket.ru';
    if (vol <= 1061) return 'basket-06.wbbasket.ru';
    if (vol <= 1115) return 'basket-07.wbbasket.ru';
    if (vol <= 1169) return 'basket-08.wbbasket.ru';
    if (vol <= 1313) return 'basket-09.wbbasket.ru';
    if (vol <= 1601) return 'basket-10.wbbasket.ru';
    if (vol <= 1655) return 'basket-11.wbbasket.ru';
    if (vol <= 1919) return 'basket-12.wbbasket.ru';
    if (vol <= 2045) return 'basket-13.wbbasket.ru';
    if (vol <= 2189) return 'basket-14.wbbasket.ru';
    if (vol <= 2405) return 'basket-15.wbbasket.ru';
    if (vol <= 2621) return 'basket-16.wbbasket.ru';
    if (vol <= 2837) return 'basket-17.wbbasket.ru';
    return 'basket-18.wbbasket.ru';
  }
}

export const priceParserService = new PriceParserService();
