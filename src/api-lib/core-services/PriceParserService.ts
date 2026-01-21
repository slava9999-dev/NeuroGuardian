import { fetchWithRetry } from '../lib/index.js';

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
}

export class PriceParserService {
  /**
   * Get Real Buyer Price from Wildberries (Public Mobile API)
   * This mimics the mobile app requests to get the actual price including SPP.
   * Updated: Using v4 API (v1/v2 deprecated as of Jan 2026)
   */
  async getWbRealPrice(article: string | number): Promise<RealPriceInfo> {
    const nmId = Number(article);
    const nmIdStr = String(article);

    // 1. Resolve Basket Host (Sharding Logic)
    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    const basketHost = this.getWbBasketHost(vol);
    const staticCardUrl = `https://${basketHost}/vol${vol}/part${part}/${nmId}/info/ru/card.json`;

    // 2. Prepare Dynamic Price URLs (card.wb.ru)
    // UPDATED: v4 is the current working version (v1/v2 deprecated)
    const dynamicUrls = [
      // v4 API - Current working version
      `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nmIdStr}`,
      // Fallback v4 without spp
      `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&nm=${nmIdStr}`,
    ];

    let productTitle = `Товар ${nmIdStr}`;
    let sellerPrice = 0;
    let buyerPrice = 0;
    const currency = 'RUB';
    let rating = 0;
    let reviewCount = 0;
    let found = false;
    let errorMsg = '';

    // Step A: Try Dynamic Price API (Preferred)
    for (const url of dynamicUrls) {
      try {
        const res = await fetchWithRetry(
          url,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            },
          },
          1
        );

        if (res.ok) {
          const data = await res.json();
          const p = data.data?.products?.[0] || data.products?.[0]; // v4 has products at root level
          if (p) {
            const size = p.sizes?.[0];
            if (size && size.price) {
              // v4 API format: price.basic (in kopecks), price.product (buyer price in kopecks)
              const basic = (size.price.basic || 0) / 100;
              const product = (size.price.product || size.price.total || 0) / 100;

              sellerPrice = Math.round(basic);
              buyerPrice = Math.round(product);
              productTitle = p.name || productTitle;
              rating = p.reviewRating || p.rating || 0;
              reviewCount = p.feedbacks || p.nmFeedbacks || 0;
              found = true;
              break; // Success
            }
          }
        }
      } catch {
        // ignore and try next
      }
    }

    // Step B: Fallback to Static Card (Reliable existence check)
    if (!found) {
      try {
        const res = await fetchWithRetry(staticCardUrl, {}, 1);
        if (res.ok) {
          const card = await res.json();
          found = true;
          productTitle = card.imt_name || card.subj_name || productTitle;
          // Static card usually has no price or cached price. We rely on it mainly for existence check.
          // Sometimes it has `priceU` in other fields, but rarely accurate for buyer.
          errorMsg = 'Price hidden (Anti-Bot). Use Search.';
        } else {
          errorMsg = `Product not found (404 on basket) or blocked.`;
        }
      } catch (e) {
        errorMsg = `Static fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (!found) {
      return {
        marketplace: 'wb',
        productId: nmIdStr,
        sellerPrice: 0,
        buyerPrice: 0,
        currency: 'RUB',
        error: errorMsg || 'All endpoints failed',
      };
    }

    return {
      marketplace: 'wb',
      productId: nmIdStr,
      title: productTitle,
      sellerPrice: sellerPrice,
      buyerPrice: buyerPrice,
      currency,
      rating,
      reviewCount,
      error: sellerPrice === 0 ? 'Price parsing blocked (got metadata only)' : undefined,
    };
  }

  // Sharding Helper
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

  /**
   * Get Real Buyer Price from Ozon (Public HTML/JSON)
   * Note: Ozon is heavily protected. This is a "Best Effort" attempt using standard fetch.
   * For production reliability, this should be routed through a Scraping API (ZenRows/ScraperAPI).
   */
  async getOzonRealPrice(sku: string): Promise<RealPriceInfo> {
    // Note: Ozon URL would be https://www.ozon.ru/product/${sku}
    // But direct fetch is blocked by anti-bot protection.
    try {
      // Ozon requires Cookies/Rendering. Simple fetch often gets 403 or CAPTCHA.
      // We will try to fetch a specific mobile API endpoint if possible, or fail gracefully advising a Proxy.
      // Public Composer API is sometimes open.

      // Strategy A: Try Composer API (Mobile) - heavily guarded but sometimes works with right headers.
      // Strategy B: Return a "Not Implemented" for basic version or mock if in TEST_MODE.

      // For this combat tool, we acknowledge the limitation.
      // We will return a specific error code that the Agent can interpret.

      return {
        marketplace: 'ozon',
        productId: sku,
        sellerPrice: 0,
        buyerPrice: 0,
        currency: 'RUB',
        error:
          'Ozon Protected: Requires Browser Agent (Anti-Bot bypass). Please use the architectural upgrade to connect ZenRows.',
      };
    } catch (e) {
      return {
        marketplace: 'ozon',
        productId: sku,
        sellerPrice: 0,
        buyerPrice: 0,
        currency: 'RUB',
        error: 'Failed to access Ozon',
        raw: e,
      };
    }
  }
}

export const priceParserService = new PriceParserService();
