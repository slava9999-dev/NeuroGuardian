// ============================================
// NeuroGUARDIAN — Set Stop Loss Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { defineTool } from '../ToolRegistry.js';
import { SetStopLossArgsSchema, type SetStopLossArgs } from '../../../api-lib/agent/validators.js';

/**
 * Set Stop Loss Tool
 *
 * Sets minimum price protection for a product.
 * When marketplace drops price below min_price, Sentinel will restore it.
 */
export const setStopLossTool = defineTool<SetStopLossArgs>({
  name: 'set_stop_loss',
  description:
    'Установить минимальную цену защиты для товара. Если маркетплейс снизит цену ниже — система автоматически восстановит её.',
  schema: SetStopLossArgsSchema,
  category: 'write',
  requiresConfirmation: true,
  examples: [
    'User: "защити товар минимум 500 рублей" → set_stop_loss({ product_id: "...", min_price: 500 })',
    'User: "установи минималку 10% от текущей" → set_stop_loss({ product_id: "...", percentage: 10 })',
  ],

  async execute(userId, args) {
    try {
      const { getFilteredProducts, updateProductMinPrice } =
        await import('../../../api-lib/services/database.js');

      // Manual validation to ensure data integrity
      const validation = SetStopLossArgsSchema.safeParse(args);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error.issues.map(i => i.message || i.path.join('.')).join(', '),
        };
      }

      // Find the product directly via SQL
      const products = await getFilteredProducts(userId, {
        search: args.product_id,
        limit: 1,
      });

      const product = products[0];

      if (!product) {
        return {
          success: false,
          error: `Товар с артикулом/ID «${args.product_id}» не найден.`,
        };
      }

      let finalMinPrice = args.min_price;

      if (!finalMinPrice && args.percentage) {
        if (!product.current_price) {
          return {
            success: false,
            error: 'Не удалось определить текущую цену для расчета защиты в процентах.',
          };
        }
        finalMinPrice = Math.round(product.current_price * (1 - args.percentage / 100));
      }

      if (!finalMinPrice) {
        if (!product.current_price) {
          return { success: false, error: 'Укажите минимальную цену (min_price) для товара.' };
        }
        // Default to 10% protection if nothing specified
        finalMinPrice = Math.round(product.current_price * 0.9);
      }

      // Validate min_price is reasonable
      if (product.current_price && finalMinPrice > product.current_price * 1.5) {
        return {
          success: false,
          error: `Минимальная цена (${finalMinPrice}₽) слишком высокая. Текущая цена: ${product.current_price}₽. Рекомендую установить min_price ниже текущей.`,
        };
      }

      // Calculate protection margin
      const protectionMargin = product.current_price
        ? Math.round(((product.current_price - finalMinPrice) / product.current_price) * 100)
        : 0;

      // Update min_price in database
      await updateProductMinPrice(userId, product.product_id, finalMinPrice);

      return {
        success: true,
        data: {
          product_id: product.product_id,
          product_title: product.title || 'Без названия',
          marketplace: product.marketplace,
          current_price: product.current_price,
          min_price: finalMinPrice,
          protection_margin: protectionMargin,
          message: `Защита установлена! Минимум ${finalMinPrice}₽ для «${product.title}»`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка при установке защиты: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
