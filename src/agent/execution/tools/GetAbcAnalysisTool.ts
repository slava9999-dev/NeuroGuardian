import { defineTool } from '../ToolRegistry.js';
import { GetAbcAnalysisArgsSchema } from '../../../api-lib/agent/validators.js';

export const getAbcAnalysisTool = defineTool({
  name: 'get_abc_analysis',
  description:
    'ABC-анализ товаров на основе выручки. Разделяет товары на категории A (80% выручки), B (15%) и C (5%).',
  category: 'analyze',
  requiresConfirmation: false,
  schema: GetAbcAnalysisArgsSchema,
  examples: [
    'Сделай ABC-анализ',
    'Какие товары приносят больше всего прибыли?',
    'Анализ категории C за месяц',
  ],
  execute: async (userId, args) => {
    try {
      const { sql } = await import('../../../api-lib/services/database.js');

      const daysBack = args.period === 'week' ? 7 : args.period === '3months' ? 90 : 30;

      // Industrial Grade SQL Aggregation for ABC Analysis
      // This is much faster than processing in memory
      const query = `
        WITH product_revenue AS (
          SELECT 
            marketplace_product_id as id,
            MAX(title) as title,
            MAX(marketplace) as marketplace,
            SUM(price_total) as revenue,
            SUM(quantity) as quantity
          FROM marketplace_orders
          WHERE user_id = $1
            AND order_date >= NOW() - ($2 || ' days')::INTERVAL
            ${args.marketplace ? `AND UPPER(marketplace) = $3` : ''}
            ${args.account_id ? `AND account_id = $${args.marketplace ? 4 : 3}` : ''}
          GROUP BY marketplace_product_id
        ),
        total_sum AS (
          SELECT SUM(revenue) as grand_total FROM product_revenue
        ),
        cumulative AS (
          SELECT 
            *,
            SUM(revenue) OVER (ORDER BY revenue DESC, id) as running_total,
            (SELECT grand_total FROM total_sum) as grand_total
          FROM product_revenue
        )
        SELECT 
          *,
          CASE 
            WHEN grand_total = 0 THEN 'C'
            WHEN (running_total / grand_total) <= 0.8 THEN 'A'
            WHEN (running_total / grand_total) <= 0.95 THEN 'B'
            ELSE 'C'
          END as category,
          CASE 
            WHEN grand_total = 0 THEN 0
            ELSE ROUND((revenue / grand_total) * 100, 2)
          END as share
        FROM cumulative
        ORDER BY revenue DESC
        LIMIT 100
      `;

      const params: (string | number)[] = [userId, daysBack];
      if (args.marketplace) params.push(args.marketplace.toUpperCase());
      if (args.account_id) params.push(args.account_id);

      const result = await sql.unsafe(query, params);
      const rows = result.rows;

      if (rows.length === 0) {
        return {
          success: false,
          error: 'Недостаточно данных о продажах. Пожалуйста, синхронизируйте историю заказов.',
        };
      }

      const totalRevenue = rows[0]?.grand_total || 0;

      return {
        success: true,
        data: {
          totalRevenue,
          period: args.period || 'month',
          summary: {
            A: rows.filter(r => r.category === 'A').length,
            B: rows.filter(r => r.category === 'B').length,
            C: rows.filter(r => r.category === 'C').length,
          },
          products: rows,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка анализа: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
