import { defineTool } from '../ToolRegistry.js';
import { GetWarehouseStocksArgsSchema } from '../../../api-lib/agent/validators.js';
import {
  getMarketplaceKeys,
  fetchOzonStocksV3,
  fetchWbStocks,
} from '../../../api-lib/services/index.js';

export const getWarehouseStocksTool = defineTool({
  name: 'get_warehouse_stocks',
  description: 'Проверка реальных остатков на складах маркетплейсов (FBO и FBS).',
  category: 'read',
  requiresConfirmation: false,
  schema: GetWarehouseStocksArgsSchema,
  examples: ['Какие остатки на складах?', 'Где заканчивается товар?', 'Остатки на WB FBS'],
  execute: async (userId, args) => {
    const keys = await getMarketplaceKeys(userId, args.account_id);

    if (!keys.ozon && !keys.wb) {
      return { success: false, error: 'API ключи не подключены.' };
    }

    const stocks: Array<{
      product: string;
      sku: string;
      stock: number;
      marketplace: string;
      warehouse?: string;
    }> = [];

    // Fetch Ozon stocks
    if (keys.ozon && (!args.marketplace || args.marketplace === 'Ozon')) {
      try {
        const items = await fetchOzonStocksV3(keys.ozon.clientId, keys.ozon.apiKey);

        for (const item of items) {
          const totalStock = item.stocks?.reduce((sum, s) => sum + (s.present || 0), 0) || 0;

          if (!args.low_stock_only || totalStock < 10) {
            stocks.push({
              product: item.offer_id,
              sku: item.product_id?.toString() || item.offer_id,
              stock: totalStock,
              marketplace: 'Ozon',
            });
          }
        }
      } catch (e) {
        console.error('Ozon stocks error:', e);
      }
    }

    // Fetch WB stocks
    if (keys.wb && (!args.marketplace || args.marketplace === 'WB')) {
      try {
        const wbStocks = await fetchWbStocks(keys.wb, []);
        wbStocks.forEach((stock, nmId) => {
          if (!args.low_stock_only || stock < 10) {
            stocks.push({
              product: `Товар ${nmId}`,
              sku: String(nmId),
              stock: stock,
              marketplace: 'WB',
            });
          }
        });
      } catch (e) {
        console.error('WB stocks error:', e);
      }
    }

    return {
      success: true,
      data: {
        total: stocks.length,
        lowStockCount: stocks.filter(s => s.stock < 10).length,
        stocks: stocks.slice(0, 50),
      },
    };
  },
});
