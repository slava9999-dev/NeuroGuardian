import { defineTool } from '../ToolRegistry.js';
import { GetOrdersArgsSchema } from '../../../api-lib/agent/validators.js';
import {
  getMarketplaceKeys,
  fetchWbOrders,
  fetchOzonFbsUnfulfilledOrders,
} from '../../../api-lib/services/index.js';

export const getOrdersTool = defineTool({
  name: 'get_orders',
  description: 'Список последних заказов с детализацией (статус, цена, товар).',
  category: 'read',
  requiresConfirmation: false,
  schema: GetOrdersArgsSchema,
  examples: [
    'Покажи последние заказы',
    'Заказы за вчера на Ozon',
    'Какие заказы были сегодня на WB?',
  ],
  execute: async (userId, args) => {
    const keys = await getMarketplaceKeys(userId, args.account_id);

    if (!keys.ozon && !keys.wb) {
      return { success: false, error: 'API ключи не подключены.' };
    }

    // Calculate date range
    const now = new Date();
    let daysBack = 7;
    if (args.period === 'today') daysBack = 1;
    else if (args.period === 'yesterday') daysBack = 2;
    else if (args.period === 'month') daysBack = 30;

    const dateFrom = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const orders: Array<{
      id: string;
      date: string;
      product: string;
      price: number;
      status: string;
      marketplace: string;
    }> = [];

    // Fetch Ozon orders
    if (keys.ozon && (!args.marketplace || args.marketplace === 'Ozon')) {
      try {
        const postings = await fetchOzonFbsUnfulfilledOrders(keys.ozon.clientId, keys.ozon.apiKey);
        for (const posting of postings) {
          orders.push({
            id: posting.posting_number,
            date: posting.in_process_at || posting.created_at,
            product: posting.products?.[0]?.name || 'Товар Ozon',
            price: parseFloat(posting.financial_data?.products?.[0]?.price || '0'),
            status: posting.status,
            marketplace: 'Ozon',
          });
        }
      } catch (e) {
        console.error('Ozon orders error:', e);
      }
    }

    // Fetch WB orders
    if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
      try {
        const wbOrders = await fetchWbOrders(keys.wb, dateFrom);
        for (const order of wbOrders) {
          if (args.status === 'new' || (order.saleID && !order.saleID.startsWith('R'))) {
            orders.push({
              id: order.srid || order.saleID || 'unknown',
              date: order.date || new Date().toISOString(),
              product: order.subject || order.brand || 'Товар WB',
              price: order.finishedPrice || order.priceWithDisc || 0,
              status: order.isCancel ? 'cancelled' : 'delivered',
              marketplace: 'WB',
            });
          }
        }
      } catch (e) {
        console.error('WB orders error:', e);
      }
    }

    // Sort by date
    orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      data: {
        total: orders.length,
        period: args.period || 'week',
        orders: orders.slice(0, 20), // Limit to 20 for response
      },
    };
  },
});
