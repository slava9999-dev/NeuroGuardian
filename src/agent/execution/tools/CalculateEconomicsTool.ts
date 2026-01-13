// ============================================
// NeuroGUARDIAN — Calculate Unit Economics Tool
// Version: 5.0.1 | Date: January 2026
// ============================================

import { z } from 'zod';
import { defineTool } from '../ToolRegistry.js';
import type { DBProduct } from '../../../api-lib/lib/types.js';

/**
 * Arguments schema for calculate_unit_economics tool
 */
const CalculateUnitEconomicsArgsSchema = z.object({
  product_id: z.string().optional().describe('Product ID to calculate for'),
  cost_price: z.number().positive().optional().describe('Cost price (себестоимость) in rubles'),
  selling_price: z
    .number()
    .positive()
    .optional()
    .describe('Selling price, if different from current'),
  marketplace: z.enum(['WB', 'Ozon']).optional().describe('Marketplace for commission calculation'),
});

type CalculateUnitEconomicsArgs = z.infer<typeof CalculateUnitEconomicsArgsSchema>;

/**
 * Calculate Unit Economics Tool
 *
 * Calculates profit breakdown with all marketplace fees:
 * - Commission (15-25% depending on category)
 * - Logistics (delivery to buyer)
 * - Storage fees
 * - Acquiring (payment processing)
 * - Ozon Card discount (5% paid by seller)
 */
export const calculateUnitEconomicsTool = defineTool<CalculateUnitEconomicsArgs>({
  name: 'calculate_unit_economics',
  description:
    'Рассчитать прибыль с товара с учётом ВСЕХ комиссий маркетплейса: комиссия, логистика, хранение, эквайринг, Ozon Card.',
  schema: CalculateUnitEconomicsArgsSchema,
  category: 'analyze',
  requiresConfirmation: false,
  examples: [
    'User: "посчитай прибыль на рейлинги" → get_products({ search: "рейлинг" }) + calculate_unit_economics',
    'User: "себестоимость 2500, сколько заработаю" → calculate_unit_economics({ cost_price: 2500 })',
    'User: "выгодно ли продавать за 1500₽" → calculate_unit_economics({ selling_price: 1500, cost_price: X })',
  ],

  async execute(userId, args) {
    try {
      const { calculateUnitEconomics } =
        await import('../../../api-lib/services/unit-economics.js');
      const { getProductsByUserId } = await import('../../../api-lib/services/database.js');

      let product: DBProduct | undefined;
      let costPrice = args.cost_price;
      let sellingPrice = args.selling_price;
      let marketplace: 'WB' | 'Ozon' = args.marketplace || 'WB';

      // Find product if product_id provided
      if (args.product_id) {
        const products = await getProductsByUserId(userId);
        product = products.find(
          (p: DBProduct) => p.product_id === args.product_id || String(p.nm_id) === args.product_id
        );

        if (!product) {
          return {
            success: false,
            error: `Товар с ID ${args.product_id} не найден.`,
          };
        }

        // Use product data as defaults
        sellingPrice = sellingPrice || product.current_price;
        costPrice = costPrice || product.cost_price || 0;
        marketplace = (product.marketplace?.toUpperCase() as 'WB' | 'Ozon') || marketplace;
      }

      // Validate we have required data
      if (!sellingPrice) {
        return {
          success: false,
          error: 'Укажите цену продажи (selling_price) или выберите товар (product_id).',
        };
      }

      if (!costPrice) {
        return {
          success: false,
          error: 'Укажите себестоимость (cost_price). Это нужно для расчёта прибыли.',
          data: {
            needsInput: 'cost_price',
            question: 'Какая себестоимость товара?',
          },
        };
      }

      // Calculate using REAL service
      // This ensures 2025 rates, Ozon Card logic, and category-specific commissions are used
      const result = calculateUnitEconomics({
        price: sellingPrice,
        costPrice: costPrice,
        marketplace: marketplace,
        category: product?.category || undefined, // Service handles category matching
        // Defaults from service will be used for logistics/storage if not specific
        fulfillmentType: 'fbo',
        useOzonCard: true, // Always calculate hidden Ozon Card costs
      });

      // Determine profitability status
      const marginPercent = result.margin;
      let status: 'profitable' | 'marginal' | 'loss';
      let recommendation: string;

      if (marginPercent >= 20) {
        status = 'profitable';
        recommendation = 'Отличная маржа! Товар можно продвигать активнее.';
      } else if (marginPercent >= 10) {
        status = 'marginal';
        recommendation = 'Маржа допустимая, но следите за скидками — могут увести в минус.';
      } else if (marginPercent >= 0) {
        status = 'marginal';
        recommendation = 'Низкая маржа. Рекомендую поднять цену или снизить себестоимость.';
      } else {
        status = 'loss';
        recommendation = `УБЫТОК! При каждой продаже теряете ${Math.abs(result.profit)}₽. Срочно поднимите цену!`;
      }

      // Format warnings
      const warningMessages = result.warnings.map(w => w.message).join('\n⚠️ ');

      return {
        success: true,
        data: {
          product: product
            ? {
                id: product.product_id,
                title: product.title,
                marketplace: product.marketplace,
              }
            : null,
          calculation: {
            selling_price: result.revenue,
            cost_price: result.costPrice,
            marketplace: marketplace,

            // Fee breakdown
            fees: {
              commission: result.commission,
              commission_percent: Math.round(result.commissionRate * 100),
              logistics: result.logistics,
              storage: result.storage,
              acquiring: result.acquiring,
              ozon_card: result.ozonCardCosts,
              packaging: result.packagingCost,
              total_fees: result.totalCosts - result.costPrice, // Fees including packaging
              total_fee_percent: Math.round(
                ((result.totalCosts - result.costPrice) / result.revenue) * 100
              ),
            },

            // Result
            net_profit: result.profit,
            profit_margin_percent: result.margin,
            break_even_price: result.minSafePrice,
          },
          status,
          recommendation:
            recommendation + (warningMessages ? `\n\n⚠️ WARN: ${warningMessages}` : ''),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Ошибка расчёта: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
