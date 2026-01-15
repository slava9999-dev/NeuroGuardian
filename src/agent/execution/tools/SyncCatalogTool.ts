// ============================================
// NeuroGUARDIAN — Sync Catalog Tool
// Syncs products from marketplaces to local DB
// Version: 1.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { marketplaceService } from '../../../api-lib/core-services/MarketplaceService.js';
import { saveProducts } from '../../../api-lib/services/database.js';
import { logger } from '../../../api-lib/lib/logger.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

const SyncCatalogArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon']).optional().describe('Sync specific marketplace'),
});

type SyncCatalogArgs = z.infer<typeof SyncCatalogArgsSchema>;

export const syncCatalogTool = defineTool<SyncCatalogArgs>({
  name: 'sync_catalog',
  description:
    'Синхронизировать каталог товаров из личного кабинета маркетплейса в локальную базу данных.',
  schema: SyncCatalogArgsSchema,
  category: 'write',
  requiresConfirmation: false,
  examples: [
    'User: "синхронизируй мои товары" → sync_catalog({})',
    'User: "обнови товары с за дикие ягоды" → sync_catalog({ marketplace: "WB" })',
  ],

  async execute(userId, args) {
    try {
      const marketplaces: ('WB' | 'Ozon')[] = args.marketplace
        ? [args.marketplace]
        : ['WB', 'Ozon'];

      let totalImported = 0;
      const summaries: string[] = [];

      for (const mp of marketplaces) {
        try {
          logger.info(`[SyncCatalog] Starting sync for ${mp}`, { userId });
          const products = await marketplaceService.fetchProducts(userId, mp);

          if (products && products.length > 0) {
            // Map MarketplaceProduct to DBProduct partial
            const dbProducts: Partial<DBProduct>[] = products.map(p => ({
              product_id: p.product_id,
              nm_id: p.nm_id,
              title: p.title,
              image_url: p.image_url,
              current_price: p.current_price,
              current_stock: p.current_stock,
              marketplace: mp,
            }));

            await saveProducts(userId, dbProducts);
            totalImported += dbProducts.length;
            summaries.push(`✅ ${mp}: синхронизировано ${dbProducts.length} товаров.`);
          } else {
            summaries.push(`ℹ️ ${mp}: товары не найдены.`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.warn(`[SyncCatalog] Failed to sync ${mp}:`, { error: msg, userId });

          if (msg.includes('not configured')) {
            summaries.push(`❌ ${mp}: не настроены API ключи.`);
          } else {
            summaries.push(`❌ ${mp}: ошибка синхронизации (${msg}).`);
          }
        }
      }

      return {
        success: true,
        data: {
          imported: totalImported,
          summary: summaries.join('\n'),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Критическая ошибка при синхронизации: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
