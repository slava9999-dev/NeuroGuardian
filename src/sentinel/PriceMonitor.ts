import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import {
  getMarketplaceKeys,
  fetchWbPrices,
  fetchOzonCurrentPrices,
} from '../api-lib/services/marketplace.js';
import type { PriceMonitor } from './types.js';

export class SentinelPriceMonitor implements PriceMonitor {
  async fetchAll(user: DBUser, products: DBProduct[]) {
    const prices = {
      wb: new Map<number, number>(),
      ozon: new Map<number, number>(),
      errors: [] as string[],
    };

    const keys = await getMarketplaceKeys(user.id);
    if (!keys.wb && !keys.ozon) return prices;

    // --- WB Monitoring ---
    if (keys.wb) {
      const wbProducts = products.filter(p => p.marketplace === 'WB');
      const nmIds = wbProducts.map(p => p.nm_id).filter((id): id is number => id !== null);

      if (nmIds.length > 0) {
        try {
          const { priceMap, error } = await fetchWbPrices(keys.wb, nmIds);
          if (error) {
            prices.errors.push(`WB API Error (User ${user.id}): ${error}`);
          } else {
            // Merge into result map
            for (const [id, price] of priceMap.entries()) {
              prices.wb.set(id, price);
            }
          }
        } catch (err) {
          prices.errors.push(
            `WB Fetch Threat (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // --- Ozon Monitoring ---
    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);

      if (ozonIds.length > 0) {
        try {
          // Use resilient fetch with fallback to DB values if strictly necessary, but prefer live
          const ozonPriceMap = await fetchOzonCurrentPrices(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            ozonIds
          );

          // REMOVED: Silent fallback to DB prices (`product.current_price`).
          // If API returns 0 prices, we must report an error/warning, not pretend everything is fine.
          if (ozonPriceMap.size === 0) {
            prices.errors.push(
              `Ozon Monitor Warning: API returned 0 prices for ${ozonIds.length} products (User ${user.id})`
            );
          } else if (ozonPriceMap.size < ozonIds.length) {
            // Optional: Warn about partial missing prices
            // prices.errors.push(`Ozon Monitor: Only ${ozonPriceMap.size}/${ozonIds.length} prices retrieved`);
          }

          for (const [id, price] of ozonPriceMap.entries()) {
            prices.ozon.set(id, price);
          }
        } catch (err) {
          prices.errors.push(
            `Ozon API Error (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return prices;
  }
}
