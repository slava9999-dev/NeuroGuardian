import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import { marketplaceService } from '../api-lib/core-services/MarketplaceService.js';
import { logger } from '../api-lib/lib/logger.js';
import type { PriceMonitor } from './types.js';

export class SentinelPriceMonitor implements PriceMonitor {
  async fetchAll(user: DBUser, products: DBProduct[]) {
    const prices = {
      wb: new Map<string, number>(),
      ozon: new Map<string, number>(),
      errors: [] as string[],
    };

    // 1. Group products by (account_id, marketplace) to support true Multi-Account
    const groups = new Map<
      string,
      {
        accountId: number | undefined;
        marketplace: 'WB' | 'Ozon';
        products: DBProduct[];
      }
    >();

    for (const p of products) {
      const mkt = p.marketplace as 'WB' | 'Ozon';
      const accId = p.account_id || undefined;
      const key = `${accId || 'legacy'}-${mkt}`;

      if (!groups.has(key)) {
        groups.set(key, { accountId: accId, marketplace: mkt, products: [] });
      }
      groups.get(key)!.products.push(p);
    }

    // 2. Process each group independently
    for (const group of groups.values()) {
      const { accountId, marketplace, products: groupProducts } = group;

      if (marketplace === 'WB') {
        const nmIds = groupProducts.map(p => p.nm_id).filter((id): id is string => id !== null);
        if (nmIds.length === 0) continue;

        try {
          logger.debug(`[PriceMonitor] WB fetch for Account ${accountId || 'Legacy'}`, {
            userId: user.id,
            count: nmIds.length,
          });

          const result = await marketplaceService.fetchCurrentPrices(
            user.id,
            'WB',
            nmIds,
            accountId
          );

          if (result.errors) {
            prices.errors.push(
              ...result.errors.map(e => `WB (Acc ${accountId || 'Legacy'}): ${e}`)
            );
          }

          for (const [id, price] of result.prices.entries()) {
            prices.wb.set(String(id), price);
          }
        } catch (err) {
          prices.errors.push(
            `WB Error (Acc ${accountId || 'Legacy'}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (marketplace === 'Ozon') {
        const ozonIds = groupProducts
          .map(p => {
            const pid = p.product_id;
            return pid.startsWith('ozon-') ? parseInt(pid.replace('ozon-', '')) : parseInt(pid);
          })
          .filter(id => !isNaN(id) && id > 0);

        if (ozonIds.length === 0) continue;

        try {
          logger.debug(`[PriceMonitor] Ozon fetch for Account ${accountId || 'Legacy'}`, {
            userId: user.id,
            count: ozonIds.length,
          });

          const result = await marketplaceService.fetchCurrentPrices(
            user.id,
            'Ozon',
            ozonIds,
            accountId
          );

          if (result.errors) {
            prices.errors.push(
              ...result.errors.map(e => `Ozon (Acc ${accountId || 'Legacy'}): ${e}`)
            );
          }

          for (const [id, price] of result.prices.entries()) {
            // Store as raw ID string to match product.product_id logic
            prices.ozon.set(String(id), price);
          }
        } catch (err) {
          prices.errors.push(
            `Ozon Error (Acc ${accountId || 'Legacy'}): ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    return prices;
  }
}
