// ============================================
// NeuroGUARDIAN — Get Sales Stats Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { defineTool } from '../ToolRegistry.js';
import {
  GetSalesStatsArgsSchema,
  type GetSalesStatsArgs,
} from '../../../api-lib/agent/validators.js';

/**
 * Get Sales Stats Tool
 *
 * Industrial implementation with local DB caching + API fallback
 */
export const getSalesStatsTool = defineTool<GetSalesStatsArgs>({
  name: 'get_sales_stats',
  description: 'Get sales statistics (orders, revenue, etc) for a period',
  schema: GetSalesStatsArgsSchema,
  category: 'analyze',
  requiresConfirmation: false,
  examples: ['sales stats for last week', 'how much revenue today', 'sales on ozon last month'],

  async execute(userId: number, args: GetSalesStatsArgs) {
    try {
      const { sql } = await import('../../../api-lib/services/database.js');
      const { from, to } = calculateDateRange(args.period || 'week');

      // 1. Try to fetch from LOCAL database first (FAST & RESILIENT)
      const localStatsQuery = `
        SELECT 
          marketplace,
          COUNT(*) as orders_count,
          SUM(price_total) as revenue_sum,
          COUNT(*) FILTER (WHERE status = 'returned' OR status = 'cancelled') as returns_count
        FROM marketplace_orders
        WHERE user_id = $1
          AND order_date >= $2
          AND order_date <= $3
          ${args.marketplace ? `AND UPPER(marketplace) = $4` : ''}
          ${args.account_id ? `AND account_id = $${args.marketplace ? 5 : 4}` : ''}
        GROUP BY marketplace
      `;

      const params = [userId, from.toISOString(), to.toISOString()];
      if (args.marketplace) params.push(args.marketplace.toUpperCase());
      if (args.account_id) params.push(args.account_id);

      const localResult = await sql.unsafe(localStatsQuery, params);

      let totalOrders = 0;
      let totalRevenue = 0;
      const byMarketplace: any[] = [];

      if (localResult.rows.length > 0) {
        for (const row of localResult.rows) {
          const revenue = Number(row.revenue_sum || 0);
          const orders = Number(row.orders_count || 0);

          byMarketplace.push({
            marketplace: row.marketplace,
            orders: orders,
            revenue: Math.round(revenue),
            returns: Number(row.returns_count || 0),
            avgOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
          });

          totalOrders += orders;
          totalRevenue += revenue;
        }
      } else {
        // 2. Fallback to API if no local data (or for real-time fresh snapshot)
        // This ensures the tool works even if sync hasn't run yet
        const { marketplaceService } =
          await import('../../../api-lib/core-services/MarketplaceService.js');

        if (!args.marketplace || args.marketplace === 'WB') {
          const stats = await marketplaceService.fetchSalesStats(userId, 'WB', from, to);
          if (stats) {
            byMarketplace.push({
              marketplace: 'WB',
              orders: stats.orders,
              revenue: stats.revenue,
              returns: stats.returns,
              avgOrderValue: stats.orders > 0 ? Math.round(stats.revenue / stats.orders) : 0,
            });
            totalOrders += stats.orders;
            totalRevenue += stats.revenue;
          }
        }

        if (!args.marketplace || args.marketplace === 'Ozon') {
          const stats = await marketplaceService.fetchSalesStats(userId, 'Ozon', from, to);
          if (stats) {
            byMarketplace.push({
              marketplace: 'Ozon',
              orders: stats.orders,
              revenue: stats.revenue,
              returns: stats.returns,
              avgOrderValue: stats.orders > 0 ? Math.round(stats.revenue / stats.orders) : 0,
            });
            totalOrders += stats.orders;
            totalRevenue += stats.revenue;
          }
        }
      }

      if (byMarketplace.length === 0) {
        return {
          success: false,
          error: 'Данные за этот период еще не синхронизированы. Запустите синхронизацию каталога.',
        };
      }

      const trend = calculateTrend(totalOrders, args.period || 'week');

      return {
        success: true,
        data: {
          period: args.period || 'week',
          dateFrom: from.toISOString().split('T')[0],
          dateTo: to.toISOString().split('T')[0],
          summary: {
            orders: totalOrders,
            revenue: Math.round(totalRevenue),
            avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
          },
          byMarketplace,
          trend,
          recommendation: generateRecommendation(totalOrders, totalRevenue, trend),
          dataSource: localResult.rows.length > 0 ? 'local_db' : 'marketplace_api',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка при загрузке статистики: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

/**
 * Calculate date range from period name
 */
function calculateDateRange(period: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  switch (period) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case 'week':
      from.setDate(from.getDate() - 7);
      break;
    case 'month':
      from.setMonth(from.getMonth() - 1);
      break;
    case 'year':
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      from.setDate(from.getDate() - 7);
  }

  return { from, to };
}

/**
 * Calculate trend indicator
 */
function calculateTrend(
  orders: number,
  period: string
): { direction: 'up' | 'down' | 'stable'; percentage: number } {
  // Estimate based on expected volume
  const expectedDaily = 5;
  const days = period === 'today' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 1;
  const expected = expectedDaily * days;

  if (orders > expected * 1.2) {
    return { direction: 'up', percentage: Math.round(((orders - expected) / expected) * 100) };
  } else if (orders < expected * 0.8) {
    return { direction: 'down', percentage: Math.round(((expected - orders) / expected) * 100) };
  }
  return { direction: 'stable', percentage: 0 };
}

/**
 * Generate smart recommendation
 */
function generateRecommendation(
  orders: number,
  revenue: number,
  trend: { direction: string }
): string {
  if (orders === 0) {
    return 'Нет заказов за период. Проверьте остатки и актуальность цен.';
  }

  if (trend.direction === 'up') {
    return 'Продажи растут! Следите за остатками, чтобы не упустить спрос.';
  }

  if (trend.direction === 'down') {
    return 'Продажи снизились. Рекомендую проверить цены конкурентов и запустить акцию.';
  }

  return `Стабильные продажи: ${orders} заказов на ${revenue.toLocaleString('ru-RU')}₽`;
}
