// ============================================
// NeuroGUARDIAN — Economics Calculator
// Part of the Unit Economics & ProfitEngine module
// ============================================

import { calculateUnitEconomics, estimateCostPrice } from './unit-economics.js';
import type { UnitEconomicsResult } from './unit-economics.js';
import type { DBProduct } from '../lib/types.js';
import { sql } from './database.js';

export class EconomicsCalculator {
  /**
   * Calculate net profit and margin for a product
   */
  async calculateNetProfit(
    productId: string | number,
    userId: number
  ): Promise<UnitEconomicsResult> {
    // 1. Fetch product data from DB
    const res = await sql`
      SELECT * FROM products 
      WHERE user_id = ${userId} AND (product_id = ${String(productId)} OR nm_id = ${Number(productId)})
      LIMIT 1
    `;

    if (res.rows.length === 0) {
      throw new Error(`Product ${productId} not found for user ${userId}`);
    }

    const product = res.rows[0] as DBProduct;

    // 2. Use Unit Economics service
    const costPrice =
      product.cost_price ||
      estimateCostPrice(product.current_price, product.category || undefined).costPrice;

    // We use current_price (Seller price) for base calculation
    // Final price paid by buyer might be lower due to SPP
    const result = calculateUnitEconomics({
      price: product.current_price,
      costPrice: costPrice,
      category: product.category || undefined,
      marketplace: product.marketplace,
      includeSpp: true, // Account for estimated platform discounts
    });

    return result;
  }

  /**
   * Get profit zones for visualization
   */
  getProfitZones(result: UnitEconomicsResult) {
    return {
      green: { from: result.recommendedMinPrice, label: 'Плюс' },
      yellow: { from: result.minSafePrice, to: result.recommendedMinPrice, label: 'Около нуля' },
      red: { below: result.minSafePrice, label: 'Убыток' },
    };
  }
}

export const economicsCalculator = new EconomicsCalculator();
