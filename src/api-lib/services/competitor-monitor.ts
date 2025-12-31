// ============================================
// NeuroGUARDIAN — Competitor Monitor Service
// Real-time price fetching from external marketplaces
// Version: 1.0.0 | Date: December 2024
// ============================================

interface CompetitorData {
  nmId: number;
  price: number; // Текущая цена продажи (со всеми скидками)
  basicPrice: number; // Цена до скидок (для аналитики)
  available: boolean; // Есть ли в наличии
  stock: number; // Остаток (приблизительно)
}

/**
 * Fetches real-time data for a Wildberries competitor product
 * Uses public API used by WB mobile app/website
 */
export async function fetchWbCompetitorData(nmId: number | string): Promise<CompetitorData | null> {
  // WB API Endpoint (dest=-1257786 is Moscow default)
  // curr=rub (rubles)
  const url = `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nmId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`WB API Error: ${response.status} ${response.statusText}`);
    }

    interface WbPublicProduct {
      salePriceU?: number;
      priceU?: number;
      sizes?: Array<{
        stocks?: Array<{ qty: number }>;
      }>;
    }

    const data = (await response.json()) as { data?: { products?: WbPublicProduct[] } };

    if (!data.data?.products?.length) {
      console.warn(`Competitor monitor: Product ${nmId} not found on WB`);
      return null;
    }

    const product = data.data.products[0];

    // WB API prices are in kopecks (cents), so divide by 100
    // salePriceU - цена продажи (с СПП и всеми скидками)
    // priceU - базовая цена (зачеркнутая)

    // Fallback: иногда salePriceU нет, берем priceU
    const finalPrice = ((product.salePriceU || product.priceU) ?? 0) / 100;
    const basicPrice = ((product.priceU || product.salePriceU) ?? 0) / 100;

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
    // В боевом режиме не возвращаем заглушки, возвращаем null (ошибка получения)
    return null;
  }
}

/**
 * Fetches data for Ozon competitor
 * NOTE: Ozon does not have a public stable API for scraping without heavy protection.
 * For v3.0 we explicitly verify if we can fetch it, if not - return error.
 */
export async function fetchOzonCompetitorData(_productId: string): Promise<CompetitorData | null> {
  // TODO: Implement Ozon parsing (requires specialized proxy/scraper service)
  // For now, to ensure production stability, we log warning and return null
  // instead of faking data or using unstable parsers.
  console.warn('Ozon competitor monitoring requires external scraping service integration.');
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
