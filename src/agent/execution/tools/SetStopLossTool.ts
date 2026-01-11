// ============================================
// NeuroGUARDIAN — Set Stop Loss Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

/**
 * Arguments schema for set_stop_loss tool
 */
const SetStopLossArgsSchema = z.object({
  product_id: z.string().describe('Product ID to protect'),
  min_price: z.number().positive().describe('Minimum allowed price in rubles'),
  notify_on_trigger: z
    .boolean()
    .optional()
    .default(true)
    .describe('Send Telegram notification when protection triggers'),
});

type SetStopLossArgs = z.infer<typeof SetStopLossArgsSchema>;

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
    'User: "установи минималку 1000₽" → set_stop_loss({ product_id: "...", min_price: 1000 })',
  ],

  async execute(userId, args) {
    try {
      const { getProductsByUserId, updateProductMinPrice } =
        await import('../../../api-lib/services/database.js');

      // Find the product
      const products = await getProductsByUserId(userId);
      const product = products.find(
        (p: DBProduct) => p.product_id === args.product_id || String(p.nm_id) === args.product_id
      );

      if (!product) {
        return {
          success: false,
          error: `Товар с ID ${args.product_id} не найден. Проверьте ID или используйте get_products для поиска.`,
        };
      }

      // Validate min_price is reasonable
      if (product.current_price && args.min_price > product.current_price * 1.5) {
        return {
          success: false,
          error: `Минимальная цена (${args.min_price}₽) слишком высокая. Текущая цена: ${product.current_price}₽. Рекомендую установить min_price ниже текущей.`,
        };
      }

      // Calculate protection margin
      const protectionMargin = product.current_price
        ? Math.round(((product.current_price - args.min_price) / product.current_price) * 100)
        : 0;

      // Update min_price in database
      await updateProductMinPrice(userId, product.product_id, args.min_price);

      return {
        success: true,
        data: {
          product_id: product.product_id,
          product_title: product.title || 'Без названия',
          marketplace: product.marketplace,
          current_price: product.current_price,
          min_price: args.min_price,
          protection_margin: protectionMargin,
          message: `Защита установлена! Минимум ${args.min_price}₽ для «${product.title}»`,
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
