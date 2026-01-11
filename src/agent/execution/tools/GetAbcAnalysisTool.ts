import { defineTool } from '../ToolRegistry.js';
import { GetAbcAnalysisArgsSchema } from '../../../api-lib/agent/validators.js';
import { syncSalesHistory } from '../../../api-lib/services/marketplace.js';
import { getProductsByUserId, getSalesHistory } from '../../../api-lib/services/index.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

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
    // 1. Calculate date range
    const now = new Date();
    let daysBack = 30;
    if (args.period === 'week') daysBack = 7;
    else if (args.period === '3months') daysBack = 90;

    const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // 2. Sync fresh data
    await syncSalesHistory(userId, daysBack, args.account_id);

    // 3. Fetch from DB
    const [products, orders] = await Promise.all([
      getProductsByUserId(userId, args.account_id),
      getSalesHistory(userId, dateFrom, now, args.account_id),
    ]);

    if (products.length === 0) return { success: false, error: 'Нет товаров для анализа' };

    // 4. Aggregate revenue
    const revenueMap = new Map<string, { revenue: number; quantity: number }>();
    for (const order of orders) {
      const productId = order.product_id; // Using internal ID
      const current = revenueMap.get(productId) || { revenue: 0, quantity: 0 };
      current.revenue += Number(order.price_total);
      current.quantity += Number(order.quantity);
      revenueMap.set(productId, current);
    }

    // 5. Build analysis list
    const analyzed = products.map((p: DBProduct) => {
      const sales = revenueMap.get(p.product_id) || { revenue: 0, quantity: 0 };
      return {
        id: p.product_id,
        title: p.title,
        marketplace: p.marketplace,
        revenue: sales.revenue,
        quantity: sales.quantity,
      };
    });

    // 6. perform ABC
    const sorted = [...analyzed].sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((sum: number, p: { revenue: number }) => sum + p.revenue, 0);

    let cumulative = 0;
    const classified = sorted.map((p: { revenue: number }) => {
      cumulative += p.revenue;
      const percentage = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 100;
      let category: 'A' | 'B' | 'C' = percentage <= 80 ? 'A' : percentage <= 95 ? 'B' : 'C';
      if (totalRevenue === 0) category = 'C';

      return { ...p, category, share: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0 };
    });

    return {
      success: true,
      data: {
        totalRevenue,
        period: args.period || 'month',
        summary: {
          A: classified.filter((p: { category: string }) => p.category === 'A').length,
          B: classified.filter((p: { category: string }) => p.category === 'B').length,
          C: classified.filter((p: { category: string }) => p.category === 'C').length,
        },
        products: classified.slice(0, 50),
      },
    };
  },
});
