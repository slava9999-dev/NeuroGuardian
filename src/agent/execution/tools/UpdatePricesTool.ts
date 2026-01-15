// ============================================
// NeuroGUARDIAN — Update Prices Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

/**
 * Arguments schema for update_prices tool
 */
const UpdatePricesArgsSchema = z.object({
  updates: z
    .array(
      z.object({
        product_id: z.string().describe('Product ID or NM ID'),
        new_price: z.number().positive().describe('New price in rubles'),
      })
    )
    .describe('List of price updates'),
  reason: z.string().optional().describe('Reason for price change (for audit logs)'),
});

type UpdatePricesArgs = z.infer<typeof UpdatePricesArgsSchema>;

/**
 * Update Prices Tool
 *
 * Updates current price for one or multiple products.
 * Requires user confirmation.
 */
export const updatePricesTool = defineTool<UpdatePricesArgs>({
  name: 'update_prices',
  description: 'Обновить цену продажи для одного или нескольких товаров. Требует подтверждения.',
  schema: UpdatePricesArgsSchema,
  category: 'write',
  requiresConfirmation: true,
  examples: [
    'User: "поставь цену 1500 на товар 123456" → update_prices({ updates: [{ product_id: "123456", new_price: 1500 }] })',
    'User: "подними цены на 10%" → update_prices(...) — calculated by Planner',
  ],

  async execute(userId, args) {
    try {
      const { getProductsByUserId, updateProductPrice } =
        await import('../../../api-lib/services/database.js');

      const products = await getProductsByUserId(userId);
      const results: any[] = [];
      const errors: string[] = [];

      for (const update of args.updates) {
        // Find product
        const product = products.find(
          (p: DBProduct) =>
            p.product_id === update.product_id || String(p.nm_id) === update.product_id
        );

        if (!product) {
          errors.push(`Товар ${update.product_id} не найден`);
          continue;
        }

        // Validate price safety (sanity check)
        if (product.cost_price && update.new_price < product.cost_price) {
          // Warning but allowed (maybe liquidation)
          // In strict mode we might block this or ask for explicit override
        }

        if (product.min_price && update.new_price < product.min_price) {
          errors.push(
            `Цена ${update.new_price} ниже минимальной (${product.min_price}) для ${product.title}`
          );
          continue;
        }

        // Apply update
        await updateProductPrice(userId, product.product_id, update.new_price);

        results.push({
          product_id: product.product_id,
          title: product.title,
          old_price: product.current_price,
          new_price: update.new_price,
          marketplace: product.marketplace,
        });
      }

      if (results.length === 0 && errors.length > 0) {
        return {
          success: false,
          error: `Не удалось обновить цены: ${errors.join('; ')}`,
        };
      }

      return {
        success: true,
        data: {
          updated_count: results.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
          message:
            `Успешно обновлено ${results.length} товаров.` +
            (errors.length ? ` Ошибок: ${errors.length}` : ''),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка обновления цен: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
