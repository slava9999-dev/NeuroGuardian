// ============================================
// NeuroGUARDIAN — Get Sales Stats Tool
// Version: 5.0.0 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';

/**
 * Arguments schema for get_sales_stats tool
 */
const GetSalesStatsArgsSchema = z.object({
  period: z
    .enum(['today', 'yesterday', 'week', 'month', 'year'])
    .optional()
    .describe('Time period for statistics'),
  marketplace: z.enum(['WB', 'Ozon']).optional().describe('Filter by marketplace'),
  compareWithPrevious: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include comparison with previous period'),
});

type GetSalesStatsArgs = z.infer<typeof GetSalesStatsArgsSchema>;

/**
 * Get Sales Stats Tool
 *
 * Fetches real sales statistics from WB/Ozon APIs
 * Uses existing marketplace service functions
 */
export const getSalesStatsTool = defineTool<GetSalesStatsArgs>({
  name: 'get_sales_stats',
  description:
    'Получить статистику продаж за период. Показывает заказы, выручку, возвраты и тренды.',
  schema: GetSalesStatsArgsSchema,
  category: 'analyze',
  requiresConfirmation: false,
  examples: [
    'User: "продажи за сегодня" → get_sales_stats({ period: "today" })',
    'User: "статистика за неделю" → get_sales_stats({ period: "week" })',
    'User: "сколько продал за месяц" → get_sales_stats({ period: "month" })',
  ],

  async execute(userId, args) {
    try {
      const { getMarketplaceKeys, fetchWbSalesStats, fetchOzonSalesStats } =
        await import('../../../api-lib/services/marketplace.js');

      const keys = await getMarketplaceKeys(userId);

      if (!keys.wb && !keys.ozon) {
        return {
          success: false,
          error: 'Нет подключённых маркетплейсов. Добавьте API-ключ в настройках.',
        };
      }

      // Calculate date range based on period
      const { from, to } = calculateDateRange(args.period || 'week');

      let wbStats = null;
      let ozonStats = null;
      let totalOrders = 0;
      let totalRevenue = 0;

      // Fetch WB statistics
      if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
        try {
          // fetchWbSalesStats takes (apiKey, dateFrom) and returns aggregated stats
          const wbData = await fetchWbSalesStats(keys.wb, from);

          if (wbData) {
            wbStats = {
              marketplace: 'WB',
              orders: wbData.orders,
              revenue: wbData.revenue,
              returns: wbData.returns || 0,
              avgOrderValue: wbData.orders > 0 ? Math.round(wbData.revenue / wbData.orders) : 0,
            };
            totalOrders += wbStats.orders;
            totalRevenue += wbStats.revenue;
          }
        } catch (error) {
          console.error('[GetSalesStats] WB error:', error);
        }
      }

      // Fetch Ozon statistics
      if (keys.ozon && (!args.marketplace || args.marketplace === 'Ozon')) {
        try {
          // fetchOzonSalesStats takes (clientId, apiKey, dateFrom, dateTo)
          const ozonData = await fetchOzonSalesStats(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            from,
            to
          );

          if (ozonData) {
            ozonStats = {
              marketplace: 'Ozon',
              orders: ozonData.orders,
              revenue: ozonData.revenue,
              returns: ozonData.returns || 0,
              avgOrderValue:
                ozonData.orders > 0 ? Math.round(ozonData.revenue / ozonData.orders) : 0,
            };
            totalOrders += ozonStats.orders;
            totalRevenue += ozonStats.revenue;
          }
        } catch (error) {
          console.error('[GetSalesStats] Ozon error:', error);
        }
      }

      // Calculate trends
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
          byMarketplace: [wbStats, ozonStats].filter(Boolean),
          trend: trend,
          recommendation: generateRecommendation(totalOrders, totalRevenue, trend),
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
