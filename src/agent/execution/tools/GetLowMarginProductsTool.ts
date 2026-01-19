import { defineTool } from '../ToolRegistry.js';
import { GetLowMarginProductsArgsSchema } from '../../../api-lib/agent/validators.js';
import { getProductsByUserId } from '../../../api-lib/services/index.js';
import { filterProducts } from '../../../api-lib/utils/product-matcher.js';

export const getLowMarginProductsTool = defineTool({
  name: 'get_low_margin_products',
  description: 'Поиск товаров с маржинальностью ниже заданного порога.',
  category: 'analyze',
  requiresConfirmation: false,
  schema: GetLowMarginProductsArgsSchema,
  examples: ['Найди убыточные товары', 'Покажи товары с маржой ниже 10%', 'Где я теряю деньги?'],
  execute: async (userId, args) => {
    const products = await getProductsByUserId(userId, args.account_id);
    const marketplace = args.marketplace === 'all' ? undefined : args.marketplace;
    const filtered = filterProducts(products, marketplace);

    const { calculateUnitEconomics, estimateCostPrice } =
      await import('../../../api-lib/services/unit-economics.js');
    interface LowMarginResult {
      title: string | null;
      marketplace: string | null;
      price: number | null;
      margin: number;
      profit: number;
      status: string;
    }
    const results: LowMarginResult[] = []; // Explicitly typed to avoid 'never' inference

    for (const p of filtered) {
      let costPrice = p.cost_price || 0;
      if (costPrice <= 0) {
        const est = estimateCostPrice(p.current_price, p.category || undefined);
        costPrice = est.costPrice;
      }

      const econ = calculateUnitEconomics({
        price: p.current_price,
        costPrice,
        category: p.category || undefined,
        marketplace: p.marketplace as 'WB' | 'Ozon',
        useOzonCard: true,
      });

      if (econ.margin < args.threshold) {
        results.push({
          title: p.title,
          marketplace: p.marketplace,
          price: p.current_price,
          margin: econ.margin,
          profit: econ.profit,
          status: econ.margin < 0 ? '🔴 Убыток' : '🟡 Низкая маржа',
        });
      }
    }

    results.sort((a, b) => a.margin - b.margin);

    return {
      success: true,
      data: {
        count: results.length,
        threshold: args.threshold,
        products: results.slice(0, 50),
      },
    };
  },
});
