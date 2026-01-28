import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import { sql } from '../../../api-lib/services/database.js';
import {
  calculateUnitEconomics,
  estimateCostPrice,
} from '../../../api-lib/services/unit-economics.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

export const GetCatalogHealthTool = defineTool({
  name: 'get_catalog_health',
  description:
    'Анализирует маржинальность всех товаров в каталоге и выявляет финансовые риски (убыточные позиции, товары без защиты).',
  category: 'analyze',
  requiresConfirmation: false,
  schema: z.object({
    limit: z.number().default(50).describe('Количество товаров для анализа (топ по остаткам)'),
  }),
  examples: [
    'Проверь здоровье моего каталога',
    'Есть ли у меня убыточные товары?',
    'Проанализируй маржу моих топов продаж',
  ],
  execute: async (userId, args) => {
    try {
      // 1. Fetch products with stock
      const productsRes = await sql`
        SELECT * FROM products
        WHERE user_id = ${userId}
          AND current_stock > 0
        ORDER BY (current_price * current_stock) DESC
        LIMIT ${args.limit}
      `;

      const products = productsRes.rows as unknown as DBProduct[];

      if (products.length === 0) {
        return {
          success: true,
          message:
            'В вашем каталоге пока нет товаров с остатками для анализа. Синхронизируйте каталог!',
        };
      }

      const stats = {
        totalAnalyzed: products.length,
        profitable: 0, // > 15%
        marginal: 0, // 0-15%
        loss: 0, // < 0%
        unprotected: 0,
        totalStockValue: 0,
        potentialLoss: 0,
        criticalItems: [] as Array<{ title: string; price: number; margin: number; stock: number }>,
      };

      for (const p of products) {
        const costPrice =
          p.cost_price || estimateCostPrice(p.current_price, p.category || undefined).costPrice;
        const econ = calculateUnitEconomics({
          price: p.current_price,
          costPrice,
          marketplace: p.marketplace as 'WB' | 'Ozon',
          category: p.category || undefined,
        });

        stats.totalStockValue += p.current_price * p.current_stock;

        if (econ.margin > 15) stats.profitable++;
        else if (econ.margin >= 0) stats.marginal++;
        else {
          stats.loss++;
          stats.potentialLoss += Math.abs(econ.profit * p.current_stock);
          stats.criticalItems.push({
            title: p.title,
            price: p.current_price,
            margin: econ.margin,
            stock: p.current_stock,
          });
        }

        if (!p.min_price || p.min_price === 0) {
          stats.unprotected++;
        }
      }

      let message = `📊 **ОТЧЕТ ПО ЗДОРОВЬЮ КАТАЛОГА**\n\n`;
      message += `Проанализировано: **${stats.totalAnalyzed}** товаров (топ по ценности склада)\n`;
      message += `💰 Общая стоимость склада: **${Math.round(stats.totalStockValue).toLocaleString()}₽**\n\n`;

      message += `🟢 Здоровая маржа (>15%): **${stats.profitable}**\n`;
      message += `🟡 Низкая маржа (0-15%): **${stats.marginal}**\n`;
      message += `🔴 Убыточные товары: **${stats.loss}**\n\n`;

      if (stats.loss > 0) {
        message += `🚨 **РИСК УБЫТКА:** Вы теряете примерно **${Math.round(stats.potentialLoss).toLocaleString()}₽** при текущих продажах убыточных позиций!\n`;
        message += `Список критических позиций:\n`;
        stats.criticalItems.slice(0, 3).forEach(item => {
          message += ` - ${item.title}: Маржа ${item.margin}% (Сток ${item.stock} шт)\n`;
        });
      }

      if (stats.unprotected > 0) {
        message += `\n🛡️ **БЕЗОПАСНОСТЬ:** ${stats.unprotected} товаров без защиты Stop-Loss. Рекомендую настроить защиту для предотвращения неконтролируемых скидок.`;
      } else {
        message += `\n✅ Все проанализированные товары под защитой Sentinel.`;
      }

      return {
        success: true,
        data: stats,
        message,
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка анализа: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
