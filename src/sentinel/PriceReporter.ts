// ============================================
// Sentinel Price Reporter
// Generates detailed price reports for sellers
// highlighting REAL buyer prices vs Seller prices and Stop Loss breaches.
// ============================================

import type { DBProduct } from '../api-lib/lib/types.js';

export class SentinelPriceReporter {
  /**
   * Generates a Telegram-formatted report for the seller
   */
  async generateDetailedReport(products: DBProduct[]): Promise<string> {
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    // 1. Filter only interesting products (or take Top 20)
    // For now, take all monitored products but limit list length
    const trackedProducts = products.filter(p => p.is_monitored && (p.current_price || 0) > 0);
    const totalCount = trackedProducts.length;

    // Sort by: Stop Loss Breach -> High Revenue -> Others
    const sortedProducts = trackedProducts.sort((a, b) => {
      const aBreach = this.isBelowStopLoss(a);
      const bBreach = this.isBelowStopLoss(b);
      if (aBreach && !bBreach) return -1;
      if (!aBreach && bBreach) return 1;
      return (b.current_price || 0) - (a.current_price || 0);
    });

    const displayList = sortedProducts.slice(0, 15); // Telegram message limit protection

    let report = `📊 *ОТЧЕТ ПО ЦЕНАМ: ${time}*\n`;
    report += `Всего на мониторинге: ${totalCount}\n\n`;

    let breachCount = 0;

    for (const p of displayList) {
      const sellerPrice = p.current_price || 0;
      const buyerPrice = p.estimated_buyer_price || sellerPrice; // Default to seller if no vision data yet
      const stopLoss = p.min_price || 0;
      const marketplace = p.marketplace === 'WB' ? '🟣 WB' : '🔵 OZ';
      const name = p.title
        ? p.title.substring(0, 20) + (p.title.length > 20 ? '...' : '')
        : 'Товар';

      const isBreach = sellerPrice < stopLoss;

      if (isBreach) breachCount++;

      const statusIcon = isBreach ? '🔴' : '✅';
      const discount = Math.round(((sellerPrice - buyerPrice) / sellerPrice) * 100);

      report += `${statusIcon} *${name}* (${marketplace})\n`;
      report += `   💰 Вы ставите: *${sellerPrice}₽*\n`;

      if (discount > 0) {
        report += `   👀 Покупатель видит: *${buyerPrice}₽* (Скидка ${discount}%)\n`;
      } else {
        report += `   👀 Покупатель видит: ${buyerPrice}₽\n`;
      }

      if (isBreach) {
        report += `   ⚠️ *НИЖЕ STOP LOSS (${stopLoss}₽)*\n`;
      } else if (stopLoss > 0) {
        report += `   🛡️ Stop Loss: ${stopLoss}₽\n`;
      }
      report += `\n`;
    }

    if (totalCount > 15) {
      report += `_...и еще ${totalCount - 15} товаров_\n`;
    }

    if (breachCount > 0) {
      report += `\n🚨 *ВНИМАНИЕ: ${breachCount} товаров продаются ниже минимальной цены!*`;
    } else {
      report += `\n✨ Все товары в пределах маржинальности.`;
    }

    return report;
  }

  private isBelowStopLoss(p: DBProduct): boolean {
    const price = p.current_price || 0;
    const stopDecor = p.min_price || 0;
    return stopDecor > 0 && price < stopDecor;
  }

  /**
   * Optional: Use LLM to generate a summary insight
   */
  async generateInsight(_products: DBProduct[]): Promise<string> {
    try {
      // ... (Not implemented for speed/cost, using template above is better for exact numbers)
      return '';
    } catch {
      return '';
    }
  }
}

export const sentinelPriceReporter = new SentinelPriceReporter();
