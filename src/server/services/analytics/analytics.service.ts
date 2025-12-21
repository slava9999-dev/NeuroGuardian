/* eslint-disable @typescript-eslint/no-explicit-any */
import { productService } from '../product/product.service';

export class AnalyticsService {
  /**
   * Calculate Unit Economics for products
   */
  async calculateUnitEconomics(userId: number, options: any) {
    const { product_id, cost_price, marketplace = 'WB' } = options;
    const products = product_id
      ? [
          (await productService.getProductsByUserId(userId)).find(p => p.product_id === product_id),
        ].filter(Boolean)
      : (await productService.getProductsByUserId(userId)).slice(0, 10);

    // Constants (would ideally be in config or DB per user)
    const CONSTANTS = {
      WB: { COMMISSION: 0.15, LOGISTICS: 70, STORAGE: 5 },
      OZON: { COMMISSION: 0.12, LOGISTICS: 60, STORAGE: 0 },
      TAX_RATE: 0.06,
    };

    const analysis = products.map((p: any) => {
      const price = p.current_price || 0;
      const mp = (p.marketplace || marketplace) as 'WB' | 'Ozon';

      // Note: CONSTANTS has OZON uppercase, but mp allows 'Ozon'.
      // We should fix CONSTANTS keys to match expected values or normalize mp.

      // Let's normalize to uppercase for lookup if needed, but here CONSTANTS has 'OZON'.
      // Actually, let's just change CONSTANTS to use 'Ozon' if that's what we expect, OR use 'OZON' key.
      // The previous code had OZON key but trying to access via 'mp'.

      const key = mp === 'Ozon' ? 'OZON' : 'WB';
      const config = CONSTANTS[key];

      const productCost = cost_price || Math.round(price * 0.3); // Safe default
      const commission = Math.round(price * config.COMMISSION);
      const logistics = config.LOGISTICS;
      const storage = mp === 'WB' ? config.STORAGE * 7 : 0;
      const tax = Math.round(price * CONSTANTS.TAX_RATE);

      const totalCosts = productCost + commission + logistics + storage + tax;
      const profit = price - totalCosts;
      const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
      const roi = productCost > 0 ? Math.round((profit / productCost) * 100) : 0;

      return {
        id: p.product_id,
        name: p.title?.substring(0, 40),
        price,
        costPrice: productCost,
        commission,
        logistics,
        storage,
        tax,
        totalCosts,
        profit,
        margin: `${margin}%`,
        roi: `${roi}%`,
        recommendation: profit < 0 ? '🔴 Убыточно' : margin < 15 ? '🟡 Низкая маржа' : '🟢 OK',
      };
    });

    const totalProfit = analysis.reduce((s: number, p: any) => s + p.profit, 0);

    return {
      products: analysis,
      summary: {
        totalProducts: analysis.length,
        totalPotentialProfit: totalProfit,
        profitable: analysis.filter((p: any) => p.profit > 0).length,
      },
    };
  }

  /**
   * Perform ABC Analysis
   */
  async getAbcAnalysis(userId: number) {
    const products = await productService.getProductsByUserId(userId);
    const sorted = [...products].sort((a, b) => b.current_price - a.current_price);
    const totalValue = sorted.reduce((s, p) => s + p.current_price, 0);

    let cumulative = 0;
    const analyzed = sorted.map(p => {
      cumulative += p.current_price;
      const percentile = (cumulative / totalValue) * 100;
      let category = 'C';
      if (percentile <= 80) category = 'A';
      else if (percentile <= 95) category = 'B';

      return {
        id: p.product_id,
        name: p.title?.substring(0, 35),
        price: p.current_price,
        category,
      };
    });

    return {
      summary: {
        groupA: analyzed.filter(p => p.category === 'A').length,
        groupB: analyzed.filter(p => p.category === 'B').length,
        groupC: analyzed.filter(p => p.category === 'C').length,
      },
      items: analyzed,
      topAProducts: analyzed.filter(p => p.category === 'A').slice(0, 5),
    };
  }

  /**
   * Get Sales Stats (Mock + Fallback for now, moving real API calls later)
   */
  async getSalesStats(_userId: number, period: string, wbApiKey?: string) {
    if (wbApiKey) {
      // TODO: Implement actual WB API fetch here
      // For now returning the structure the agent expects
    }
    return {
      period,
      message: 'Для точной статистики подключите API ключ WB',
      mockData: true,
    };
  }
}

export const analyticsService = new AnalyticsService();
