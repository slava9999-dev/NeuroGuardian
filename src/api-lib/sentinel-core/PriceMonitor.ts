import type { DBUser, DBProduct } from '../lib/types.js';
import { marketplaceService } from '../core-services/MarketplaceService.js';
import type { PriceMonitor } from './types.js';

export class SentinelPriceMonitor implements PriceMonitor {
  async fetchAll(user: DBUser, products: DBProduct[]) {
    const prices = {
      wb: new Map<number, number>(),
      ozon: new Map<number, number>(),
      errors: [] as string[],
    };

    // Group products by marketplace to optimize calls
    // Note: This implementation currently uses the user's primary/legacy keys.
    // TODO: Support multi-account monitoring by grouping by account_id.
    const wbProducts = products.filter(p => p.marketplace === 'WB');
    const ozonProducts = products.filter(p => p.marketplace === 'Ozon');

    // --- WB Monitoring ---
    if (wbProducts.length > 0) {
      const nmIds = wbProducts.map(p => p.nm_id).filter((id): id is number => id !== null);
      if (nmIds.length > 0) {
        try {
          console.log('[PriceMonitor] Calling WB API...');
          const result = await marketplaceService.fetchCurrentPrices(user.id, 'WB', nmIds);
          console.log(`[PriceMonitor] WB Result: ${result.prices.size} prices`);

          if (result.errors) {
            prices.errors.push(...result.errors.map(e => `WB (User ${user.id}): ${e}`));
          }

          for (const [id, price] of result.prices.entries()) {
            prices.wb.set(Number(id), price);
          }
        } catch (err) {
          prices.errors.push(
            `WB Monitor Error (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    // --- Ozon Monitoring ---
    if (ozonProducts.length > 0) {
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter(id => !isNaN(id) && id > 0);

      if (ozonIds.length > 0) {
        try {
          console.log('[PriceMonitor] Calling Ozon API...');
          const result = await marketplaceService.fetchCurrentPrices(user.id, 'Ozon', ozonIds);
          console.log(`[PriceMonitor] Ozon Result: ${result.prices.size} prices`);

          if (result.errors) {
            prices.errors.push(...result.errors.map(e => `Ozon (User ${user.id}): ${e}`));
          } else if (result.prices.size === 0) {
            prices.errors.push(
              `Ozon Monitor Warning: API returned 0 prices for ${ozonIds.length} products (User ${user.id})`
            );
          }

          for (const [id, price] of result.prices.entries()) {
            prices.ozon.set(Number(id), price);
          }
        } catch (err) {
          prices.errors.push(
            `Ozon Monitor Error (User ${user.id}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return prices;
  }
}
