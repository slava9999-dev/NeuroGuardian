// ============================================
// NeuroGUARDIAN — Sentinel Agent
// Autonomous price monitoring and competitor tracking
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';
import { sql } from '../api-lib/services/database.js';
import { extractNmIdFromUrl } from '../api-lib/services/competitor-monitor.js';
import { priceParserService } from '../api-lib/core-services/PriceParserService.js';

export interface CompetitorAlert {
  productId: number;
  productName: string;
  yourPrice: number;
  competitorPrice: number;
  competitorUrl: string;
  priceDropPercent: number;
  marketplace: 'WB' | 'Ozon';
  recommendedAction: 'lower_price' | 'monitor' | 'ignore';
  recommendedPrice?: number;
}

export class SentinelAgent {
  /**
   * Monitor all products with competitor tracking enabled
   */
  async monitorAllProducts(): Promise<CompetitorAlert[]> {
    logger.info('[SentinelAgent] Starting competitor monitoring cycle');

    // Get all products with competitor_url or stop-loss monitoring enabled
    const products = await sql`
      SELECT 
        id,
        product_id,
        title,
        marketplace,
        nm_id,
        current_price,
        min_price,
        competitor_url,
        price_strategy,
        is_monitored
      FROM products
      WHERE is_monitored = true
        AND (competitor_url IS NOT NULL OR min_price > 0)
    `;

    const alerts: CompetitorAlert[] = [];

    for (const product of products.rows) {
      try {
        // 1. Check for Stop-Loss breach (Self-Protection)
        const selfAlert = await this.checkSelfProtection(product);
        if (selfAlert) {
          alerts.push(selfAlert);
        }

        // 2. Check Competitor (Market Strategy)
        if (product.competitor_url && product.competitor_url.length > 5) {
          const alert = await this.checkCompetitor(product);
          if (alert) {
            alerts.push(alert);
          }
        }
      } catch (error) {
        logger.error('[SentinelAgent] Failed to check product cycle', {
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info(`[SentinelAgent] Monitoring complete. Found ${alerts.length} alerts`);
    return alerts;
  }

  /**
   * Check single competitor and generate alert if needed
   */
  private async checkCompetitor(product: {
    id: number;
    title: string;
    marketplace: string;
    current_price: number;
    min_price: number;
    competitor_url: string;
    price_strategy: string;
  }): Promise<CompetitorAlert | null> {
    logger.info(`[SentinelAgent] Checking competitor for: ${product.title}`);

    const competitorPrice = await this.fetchCompetitorPrice(
      product.marketplace as 'WB' | 'Ozon',
      product.competitor_url
    );

    if (!competitorPrice || competitorPrice === 0) {
      logger.warn(`[SentinelAgent] Could not fetch competitor price for ${product.title}`);
      return null;
    }

    // Update competitor_price in database
    await sql`
      UPDATE products
      SET 
        competitor_price = ${competitorPrice},
        updated_at = NOW()
      WHERE id = ${product.id}
    `;

    // Calculate price difference
    const priceDiff = product.current_price - competitorPrice;
    const priceDropPercent = Math.round((priceDiff / product.current_price) * 100);

    // Determine if alert is needed (competitor is cheaper by more than 5%)
    if (priceDropPercent > 5) {
      const recommendedPrice = this.calculateRecommendedPrice(
        competitorPrice,
        product.min_price,
        product.price_strategy
      );

      return {
        productId: product.id,
        productName: product.title,
        yourPrice: product.current_price,
        competitorPrice,
        competitorUrl: product.competitor_url,
        priceDropPercent,
        marketplace: product.marketplace as 'WB' | 'Ozon',
        recommendedAction: this.determineAction(priceDropPercent, product.price_strategy),
        recommendedPrice,
      };
    }

    return null;
  }

  /**
   * Check if our own price breached stop-loss due to MP discounts
   */
  private async checkSelfProtection(product: {
    id: number;
    title: string;
    marketplace: string;
    product_id?: string;
    nm_id?: number;
    min_price: number;
  }): Promise<CompetitorAlert | null> {
    const marketplace = (product.marketplace || 'WB').toUpperCase() as 'WB' | 'OZON';
    const id = marketplace === 'WB' ? product.nm_id || product.product_id : product.product_id;

    if (!id) {
      logger.warn(`[SentinelAgent] Missing product ID for ${product.title}`);
      return null;
    }

    logger.info(`[SentinelAgent] Checking Stop-Loss for: ${product.title} (${id})`);

    try {
      const realInfo =
        marketplace === 'WB'
          ? await priceParserService.getWbRealPrice(id)
          : await priceParserService.getOzonRealPrice(String(id));

      if (realInfo.buyerPrice && product.min_price > 0 && realInfo.buyerPrice < product.min_price) {
        const lossPercent = Math.round(
          ((product.min_price - realInfo.buyerPrice) / product.min_price) * 100
        );

        logger.error(
          `[SentinelAgent] 🛑 STOP-LOSS BREACH! ${product.title}: Buyer Price ${realInfo.buyerPrice} < Min ${product.min_price}`
        );

        return {
          productId: product.id,
          productName: product.title,
          yourPrice: realInfo.buyerPrice,
          competitorPrice: product.min_price, // Using this as the threshold
          competitorUrl:
            marketplace === 'WB'
              ? `https://www.wildberries.ru/catalog/${id}/detail.aspx`
              : `https://www.ozon.ru/product/${id}/`,
          priceDropPercent: lossPercent,
          marketplace: marketplace as 'WB' | 'Ozon',
          recommendedAction: 'lower_price', // In this context it means "URGENT ACTION NEEDED"
          recommendedPrice: product.min_price,
        };
      }
    } catch (e: unknown) {
      logger.warn(`[SentinelAgent] Self-protection check failed for ${product.title}`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return null;
  }

  /**
   * Fetch competitor price using centralized service
   */
  private async fetchCompetitorPrice(
    marketplace: 'WB' | 'Ozon',
    url: string
  ): Promise<number | null> {
    const nmId = extractNmIdFromUrl(url);
    if (!nmId) return null;

    try {
      const info =
        marketplace === 'WB'
          ? await priceParserService.getWbRealPrice(nmId)
          : await priceParserService.getOzonRealPrice(String(nmId));

      return info.buyerPrice || null;
    } catch (error) {
      logger.error('[SentinelAgent] Failed to fetch competitor price', { marketplace, error });
      return null;
    }
  }

  /**
   * Calculate recommended price based on strategy
   */
  private calculateRecommendedPrice(
    competitorPrice: number,
    minPrice: number,
    strategy: string
  ): number {
    let recommended: number;

    switch (strategy) {
      case 'aggressive':
        // Undercut by 5%
        recommended = Math.round(competitorPrice * 0.95);
        break;
      case 'moderate':
        // Match competitor price
        recommended = competitorPrice;
        break;
      case 'conservative':
        // Stay within 3% of competitor
        recommended = Math.round(competitorPrice * 0.97);
        break;
      default:
        recommended = competitorPrice;
    }

    // Ensure we don't go below min_price
    return Math.max(recommended, minPrice);
  }

  /**
   * Determine recommended action based on price drop
   */
  private determineAction(
    priceDropPercent: number,
    strategy: string
  ): 'lower_price' | 'monitor' | 'ignore' {
    if (priceDropPercent > 20) {
      return 'lower_price'; // Critical: competitor is much cheaper
    } else if (priceDropPercent > 10 && strategy === 'aggressive') {
      return 'lower_price'; // Aggressive strategy: react to 10%+ drops
    } else if (priceDropPercent > 5) {
      return 'monitor'; // Watch closely
    }
    return 'ignore';
  }

  /**
   * Format alert message for Telegram
   */
  formatTelegramAlert(alert: CompetitorAlert): string {
    const emoji = alert.recommendedAction === 'lower_price' ? '🚨' : '⚠️';
    const discount = Math.round(
      ((alert.yourPrice - alert.competitorPrice) / alert.yourPrice) * 100
    );

    let message = `${emoji} <b>АЛЕРТ КОНКУРЕНТА</b>\n\n`;
    message += `📦 <b>${alert.productName}</b>\n`;
    message += `🏪 Маркетплейс: ${alert.marketplace}\n\n`;
    message += `💰 Ваша цена: <b>${alert.yourPrice} ₽</b>\n`;
    message += `💸 Цена конкурента: <b>${alert.competitorPrice} ₽</b>\n`;
    message += `📉 Разница: <b>-${discount}%</b>\n\n`;

    if (alert.recommendedPrice) {
      message += `🎯 Рекомендую: <b>${alert.recommendedPrice} ₽</b>\n`;
    }

    message += `\n🔗 <a href="${alert.competitorUrl}">Посмотреть конкурента</a>`;

    return message;
  }
}

// Singleton instance
export const sentinelAgent = new SentinelAgent();
