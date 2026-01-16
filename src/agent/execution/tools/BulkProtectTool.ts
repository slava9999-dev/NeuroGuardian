// ============================================
// NeuroGUARDIAN — Bulk Protect Products Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';

/**
 * Arguments schema for bulk_protect_products tool
 */
const BulkProtectProductsArgsSchema = z.object({
  percentage: z
    .number()
    .min(5)
    .max(30)
    .default(10)
    .describe('Percentage below current price to set as min_price'),
  marketplace: z
    .enum(['WB', 'Ozon'])
    .optional()
    .describe('Only protect products from specific marketplace'),
  only_unprotected: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only protect products without existing min_price'),
});

type BulkProtectProductsArgs = z.infer<typeof BulkProtectProductsArgsSchema>;

/**
 * Bulk Protect Products Tool
 *
 * Sets min_price for all products based on percentage below current price.
 * Example: 10% means min_price = current_price * 0.9
 */
export const bulkProtectProductsTool = defineTool<BulkProtectProductsArgs>({
  name: 'bulk_protect_products',
  description:
    'Установить защиту на ВСЕ товары. Минимальная цена = текущая цена минус указанный процент.',
  schema: BulkProtectProductsArgsSchema,
  category: 'write',
  requiresConfirmation: true,
  examples: [
    'User: "защити все товары" → bulk_protect_products({ percentage: 10 })',
    'User: "установи минималку 15% ниже текущей" → bulk_protect_products({ percentage: 15 })',
  ],

  async execute(userId, args) {
    try {
      const { bulkUpdateMinPrice } = await import('../../../api-lib/services/database.js');

      // Execute bulk update directly in DB (Industrial Grade Performance)
      const totalProtected = await bulkUpdateMinPrice(userId, args.percentage, {
        marketplace: args.marketplace,
        onlyUnprotected: args.only_unprotected,
      });

      if (totalProtected === 0) {
        return {
          success: false,
          error: args.only_unprotected
            ? 'Все подходящие товары уже защищены!'
            : 'Нет товаров для защиты.',
        };
      }

      return {
        success: true,
        data: {
          total_protected: totalProtected,
          percentage_used: args.percentage,
          marketplace: args.marketplace || 'all',
          message: `🛡️ Защита установлена на ${totalProtected} товаров! Минималка = текущая цена -${args.percentage}%`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка при массовой защите: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
