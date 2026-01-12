import { defineTool } from '../ToolRegistry.js';
import { GetStockForecastArgsSchema } from '../../../api-lib/agent/validators.js';
import { marketplaceService } from '../../../api-lib/core-services/MarketplaceService.js';
import { getProductsByUserId, getSalesHistory } from '../../../api-lib/services/index.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

export const getStockForecastTool = defineTool({
  name: 'get_stock_forecast',
  description: 'Прогноз того, когда закончатся товары на основе текущей скорости продаж.',
  category: 'analyze',
  requiresConfirmation: false,
  schema: GetStockForecastArgsSchema,
  examples: ['Когда закончится товар?', 'Прогноз остатков', 'На сколько дней хватит товара?'],
  execute: async (userId, args) => {
    // 1. Sync sales for velocity (last 30 days)
    await marketplaceService.syncSalesHistory(userId, 30, args.account_id);
    const now = new Date();
    const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 2. Fetch data
    const [products, orders] = await Promise.all([
      getProductsByUserId(userId, args.account_id),
      getSalesHistory(userId, dateFrom, now, args.account_id),
    ]);

    let targetProducts = products;
    if (args.product_id) {
      targetProducts = products.filter((p: DBProduct) => p.product_id === args.product_id);
    }

    if (targetProducts.length === 0) return { success: false, error: 'Товары не найдены' };

    // 3. Calculate velocity (units/day)
    const salesMap = new Map<string, number>();
    for (const order of orders) {
      const current = salesMap.get(order.product_id) || 0;
      salesMap.set(order.product_id, current + Number(order.quantity));
    }

    // 4. Forecast
    interface ForecastItem {
      id: string;
      title: string;
      marketplace: 'WB' | 'Ozon';
      stock: number;
      velocity: number;
      daysLeft: number;
      status: 'critical' | 'warning' | 'ok';
    }

    const forecasts: ForecastItem[] = targetProducts.map((p: DBProduct) => {
      const sold30 = salesMap.get(p.product_id) || 0;
      const velocity = sold30 / 30; // units/day
      const stock = p.current_stock || 0;

      let daysLeft = 999;
      if (stock <= 0) daysLeft = 0;
      else if (velocity > 0) daysLeft = Math.round(stock / velocity);

      return {
        id: p.product_id,
        title: p.title,
        marketplace: p.marketplace,
        stock,
        velocity: Number(velocity.toFixed(2)),
        daysLeft,
        status: (daysLeft < 7 ? 'critical' : daysLeft < 14 ? 'warning' : 'ok') as
          | 'critical'
          | 'warning'
          | 'ok',
      };
    });

    const sorted = [...forecasts].sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      success: true,
      data: {
        totalAnalyzed: forecasts.length,
        criticalCount: forecasts.filter(f => f.status === 'critical').length,
        forecasts: sorted.slice(0, 50),
      },
    };
  },
});
