// ============================================
// NeuroGUARDIAN — Bulk Protect Products Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

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
      const { getProductsByUserId, updateProductMinPrice } =
        await import('../../../api-lib/services/database.js');

      // Get all products
      let products = await getProductsByUserId(userId);

      // Filter by marketplace if specified
      if (args.marketplace) {
        products = products.filter(
          (p: DBProduct) => p.marketplace?.toUpperCase() === args.marketplace
        );
      }

      // Filter to only unprotected if specified
      if (args.only_unprotected) {
        products = products.filter((p: DBProduct) => !p.min_price);
      }

      // Filter products with valid prices
      products = products.filter((p: DBProduct) => p.current_price && p.current_price > 0);

      if (products.length === 0) {
        return {
          success: false,
          error: args.only_unprotected ? 'Все товары уже защищены!' : 'Нет товаров для защиты.',
        };
      }

      // Calculate and apply protection
      const protected_products: Array<{
        product_id: string;
        title: string;
        current_price: number;
        min_price: number;
      }> = [];

      for (const product of products) {
        const minPrice = Math.round(product.current_price * (1 - args.percentage / 100));

        if (minPrice > 0) {
          await updateProductMinPrice(userId, product.product_id, minPrice);

          protected_products.push({
            product_id: product.product_id,
            title: product.title || 'Без названия',
            current_price: product.current_price,
            min_price: minPrice,
          });
        }
      }

      return {
        success: true,
        data: {
          total_protected: protected_products.length,
          percentage_used: args.percentage,
          marketplace: args.marketplace || 'all',
          products: protected_products.slice(0, 10), // First 10 for display
          has_more: protected_products.length > 10,
          message: `Защита установлена на ${protected_products.length} товаров! Минималка = текущая цена -${args.percentage}%`,
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
