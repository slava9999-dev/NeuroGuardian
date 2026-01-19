import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { UpdateStocksArgsSchema } from '../../../api-lib/agent/validators.js';
import { getProductsByUserId } from '../../../api-lib/services/index.js';
import { filterProducts } from '../../../api-lib/utils/product-matcher.js';

export const updateStocksTool = defineTool({
  name: 'update_stocks',
  description: 'Обновление остатков товаров (только для FBS). Требует подтверждения.',
  category: 'write',
  requiresConfirmation: true,
  schema: UpdateStocksArgsSchema,
  examples: ['Установи остаток 10 для товара X', 'Обнови остатки'],
  execute: async (userId, args) => {
    // Validate arguments first
    const validation = UpdateStocksArgsSchema.safeParse(args);
    if (!validation.success) {
      const errorMessages = validation.error.issues
        .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');

      return {
        success: false,
        error: `Неверные параметры: ${errorMessages}`,
      };
    }

    const validatedArgs = validation.data;

    const products = await getProductsByUserId(userId, validatedArgs.account_id);
    interface StockUpdate {
      product_id: string;
      title: string;
      marketplace: string | null;
      currentStock: number;
      newStock: number;
    }
    const updates: StockUpdate[] = [];

    for (const item of validatedArgs.products) {
      const filtered = filterProducts(products, validatedArgs.marketplace, item.product_id);
      if (filtered.length > 0) {
        const p = filtered[0];
        updates.push({
          product_id: p.product_id,
          title: p.title,
          marketplace: p.marketplace,
          currentStock: p.current_stock || 0,
          newStock: item.new_stock,
        });
      }
    }

    if (updates.length === 0) return { success: false, error: 'Товары не найдены' };

    return {
      success: true,
      data: {
        message: 'Остатки подготовлены к обновлению',
        updates,
      },
    };
  },
});
