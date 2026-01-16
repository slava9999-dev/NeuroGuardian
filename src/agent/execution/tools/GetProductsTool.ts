// ============================================
// NeuroGUARDIAN — Get Products Tool
// Example of new tool architecture
// One file = one tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { GetProductsArgsSchema, type GetProductsArgs } from '../../../api-lib/agent/validators.js';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

/**
 * Get Products Tool
 *
 * Retrieves user's products from the database with optional filtering
 */
export const getProductsTool = defineTool<GetProductsArgs>({
  name: 'get_products',
  description:
    'Получить список товаров пользователя. Можно искать по названию, фильтровать по маркетплейсу.',
  schema: GetProductsArgsSchema,
  category: 'read',
  requiresConfirmation: false,
  examples: [
    'User: "покажи мои товары" → get_products({})',
    'User: "найди рейлинги" → get_products({ search: "рейлинг" })',
    'User: "товары на озоне" → get_products({ marketplace: "Ozon" })',
    'User: "незащищённые товары" → get_products({ unprotectedOnly: true })',
  ],

  async execute(userId, args) {
    try {
      const { getFilteredProducts } = await import('../../../api-lib/services/database.js');

      // Fetch filtered products directly from DB (Industrial Grade Performance)
      const products = await getFilteredProducts(userId, {
        search: args.search,
        marketplace: args.marketplace === 'all' ? undefined : args.marketplace,
        limit: args.limit,
        lowStockOnly: args.lowStockOnly,
        unprotectedOnly: args.unprotectedOnly,
        accountId: args.account_id,
      });

      // Format for response
      const formatted = products.map((p: DBProduct) => ({
        product_id: p.product_id,
        nm_id: p.nm_id,
        title: p.title || 'Без названия',
        marketplace: p.marketplace,
        current_price: p.current_price,
        min_price: p.min_price,
        current_stock: p.current_stock,
        cost_price: p.cost_price,
        is_protected: !!p.min_price,
        _note: 'current_price — это цена селлера (до вычета СПП). Цена на сайте может быть ниже.',
      }));

      return {
        success: true,
        data: {
          products: formatted,
          total: products.length,
          hasMore: products.length === args.limit,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка при загрузке товаров: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
