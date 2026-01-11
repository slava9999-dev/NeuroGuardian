// ============================================
// NeuroGUARDIAN — Get Products Tool
// Example of new tool architecture
// One file = one tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

/**
 * Arguments schema for get_products tool
 */
const GetProductsArgsSchema = z.object({
  search: z.string().optional().describe('Search by product name'),
  marketplace: z.enum(['WB', 'Ozon']).optional().describe('Filter by marketplace'),
  limit: z.number().min(1).max(100).default(20).describe('Max products to return'),
  lowStockOnly: z.boolean().optional().describe('Only show low stock items'),
  unprotectedOnly: z.boolean().optional().describe('Only show items without min_price'),
});

type GetProductsArgs = z.infer<typeof GetProductsArgsSchema>;

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
      const { getProductsByUserId } = await import('../../../api-lib/services/database.js');

      // Fetch all products for user
      let products = await getProductsByUserId(userId);

      // Apply filters
      if (args.marketplace) {
        products = products.filter(
          (p: DBProduct) => p.marketplace.toUpperCase() === args.marketplace
        );
      }

      if (args.search) {
        const searchLower = args.search.toLowerCase();
        products = products.filter(
          (p: DBProduct) =>
            p.title?.toLowerCase().includes(searchLower) ||
            p.product_id?.toLowerCase().includes(searchLower)
        );
      }

      if (args.lowStockOnly) {
        products = products.filter((p: DBProduct) => (p.current_stock || 0) < 10);
      }

      if (args.unprotectedOnly) {
        products = products.filter((p: DBProduct) => !p.min_price);
      }

      // Apply limit
      products = products.slice(0, args.limit);

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
