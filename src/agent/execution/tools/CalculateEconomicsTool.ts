// ============================================
// NeuroGUARDIAN — Calculate Unit Economics Tool
// Version: 5.0.0 | Date: January 2026
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
    'Рассчитать прибыль с товара с учётом ВСЕХ комиссий маркетплейса: комиссия, логистика, хранение, эквайринг.',
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
      // Inline profit calculation
      const calculateProfitBreakdown = (params: {
        sellingPrice: number;
        costPrice: number;
        marketplace: 'WB' | 'Ozon';
        category?: string;
      }) => {
        const { sellingPrice, costPrice, marketplace } = params;

        // Commission rates by marketplace (average)
        const commissionPercent = marketplace === 'WB' ? 15 : 18;
        const commission = Math.round((sellingPrice * commissionPercent) / 100);

        // Logistics (average FBO)
        const logistics = marketplace === 'WB' ? 100 : 150;

        // Storage (per month, approximate)
        const storage = 20;

        // Acquiring
        const acquiring = Math.round(sellingPrice * 0.02);

        // Ozon Card discount (seller pays 5%)
        const ozonCard = marketplace === 'Ozon' ? Math.round(sellingPrice * 0.05) : 0;

        const totalFees = commission + logistics + storage + acquiring + ozonCard;
        const totalFeePercent = Math.round((totalFees / sellingPrice) * 100);
        const netProfit = sellingPrice - costPrice - totalFees;
        const profitMarginPercent = Math.round((netProfit / sellingPrice) * 100);

        return {
          commission,
          commissionPercent,
          logistics,
          storage,
          acquiring,
          ozonCard,
          totalFees,
          totalFeePercent,
          netProfit,
          profitMarginPercent,
        };
      };

      let product = null;
      let costPrice = args.cost_price;
      let sellingPrice = args.selling_price;
      let marketplace: 'WB' | 'Ozon' = args.marketplace || 'WB';

      // Find product if product_id provided
      if (args.product_id) {
        const { getProductsByUserId } = await import('../../../api-lib/services/database.js');
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
        costPrice = costPrice || product.cost_price;
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

      // Calculate profit breakdown
      const breakdown = calculateProfitBreakdown({
        sellingPrice,
        costPrice,
        marketplace,
        category: product?.category || 'general',
      });

      // Determine profitability status
      const marginPercent = breakdown.profitMarginPercent;
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
        recommendation = `УБЫТОК! При каждой продаже теряете ${Math.abs(breakdown.netProfit)}₽. Срочно поднимите цену!`;
      }

      // Calculate break-even price
      const breakEvenPrice = Math.ceil(costPrice / (1 - breakdown.totalFeePercent / 100));

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
            selling_price: sellingPrice,
            cost_price: costPrice,
            marketplace: marketplace,

            // Fee breakdown
            fees: {
              commission: breakdown.commission,
              commission_percent: breakdown.commissionPercent,
              logistics: breakdown.logistics,
              storage: breakdown.storage,
              acquiring: breakdown.acquiring,
              ozon_card: marketplace === 'Ozon' ? breakdown.ozonCard : 0,
              total_fees: breakdown.totalFees,
              total_fee_percent: breakdown.totalFeePercent,
            },

            // Result
            net_profit: breakdown.netProfit,
            profit_margin_percent: marginPercent,
            break_even_price: breakEvenPrice,
          },
          status,
          recommendation,
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
