// ============================================
// NeuroGUARDIAN — Sentinel Agent
// Autonomous price monitoring and competitor tracking
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';
import { sql } from '../api-lib/services/database.js';
import {
  fetchWbCompetitorData,
  extractNmIdFromUrl,
} from '../api-lib/services/competitor-monitor.js';
import { browserEyes } from './BrowserEyes.js';

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

    // Get all products with competitor_url set
    const products = await sql`
      SELECT 
        id,
        title,
        marketplace,
        nm_id,
        current_price,
        min_price,
        competitor_url,
        price_strategy
      FROM products
      WHERE competitor_url IS NOT NULL
        AND competitor_url != ''
        AND is_monitored = true
    `;

    const alerts: CompetitorAlert[] = [];

    for (const product of products.rows) {
      try {
        const alert = await this.checkCompetitor(product);
        if (alert) {
          alerts.push(alert);
        }
      } catch (error) {
        logger.error('[SentinelAgent] Failed to check competitor', {
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
   * Fetch competitor price using appropriate method
   */
  private async fetchCompetitorPrice(
    marketplace: 'WB' | 'Ozon',
    url: string
  ): Promise<number | null> {
    if (marketplace === 'WB') {
      // Use WB API (fast and reliable)
      const nmId = extractNmIdFromUrl(url);
      if (!nmId) {
        logger.warn('[SentinelAgent] Could not extract NM_ID from URL', { url });
        return null;
      }

      const data = await fetchWbCompetitorData(nmId);
      return data?.price || null;
    } else if (marketplace === 'Ozon') {
      // Use Browser Eyes for Ozon
      try {
        const result = await browserEyes.gazeAtProduct('Ozon', url);
        return result.buyerPrice;
      } catch (error) {
        logger.error('[SentinelAgent] Browser Eyes failed for Ozon', { error });
        return null;
      }
    }

    return null;
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
