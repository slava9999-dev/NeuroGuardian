// ============================================
// NeuroGUARDIAN — Sentinel Telegram Integration
// Send competitor alerts to Telegram with action buttons
// Version: 1.0.0 | Date: January 2026
// ============================================

import { logger } from '../api-lib/lib/logger.js';
import { config } from '../infrastructure/config/env.js';
import type { CompetitorAlert } from './SentinelAgent.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface InlineButton {
  text: string;
  callback_data: string;
}

export class SentinelTelegram {
  /**
   * Send competitor alert to user's Telegram
   */
  async sendAlert(chatId: number, alert: CompetitorAlert): Promise<void> {
    const message = this.formatAlert(alert);
    const buttons = this.createActionButtons(alert);

    try {
      await this.sendMessage(chatId, message, buttons);
      logger.info('[SentinelTelegram] Alert sent', {
        chatId,
        productId: alert.productId,
      });
    } catch (error) {
      logger.error('[SentinelTelegram] Failed to send alert', {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format alert message with emoji and HTML
   */
  private formatAlert(alert: CompetitorAlert): string {
    const emoji = alert.recommendedAction === 'lower_price' ? '🚨' : '⚠️';
    const discount = Math.round(
      ((alert.yourPrice - alert.competitorPrice) / alert.yourPrice) * 100
    );

    let message = `${emoji} <b>HUNTER MODE: Конкурент Обнаружен!</b>\n\n`;
    message += `📦 <b>${alert.productName}</b>\n`;
    message += `🏪 ${alert.marketplace}\n\n`;
    message += `💰 Ваша цена: <b>${alert.yourPrice} ₽</b>\n`;
    message += `💸 Конкурент: <b>${alert.competitorPrice} ₽</b> `;
    message += `<code>(-${discount}%)</code>\n\n`;

    if (alert.recommendedPrice) {
      const newDiscount = Math.round(
        ((alert.yourPrice - alert.recommendedPrice) / alert.yourPrice) * 100
      );
      message += `🎯 <b>Рекомендация:</b> ${alert.recommendedPrice} ₽ `;
      message += `<code>(-${newDiscount}%)</code>\n`;
    }

    message += `\n🔗 <a href="${alert.competitorUrl}">Открыть товар конкурента</a>`;

    return message;
  }

  /**
   * Create inline keyboard buttons for quick actions
   */
  private createActionButtons(alert: CompetitorAlert): InlineButton[][] {
    const buttons: InlineButton[][] = [];

    // Row 1: Primary actions
    if (alert.recommendedPrice) {
      buttons.push([
        {
          text: `✅ Снизить до ${alert.recommendedPrice} ₽`,
          callback_data: `sentinel_lower:${alert.productId}:${alert.recommendedPrice}`,
        },
      ]);
    }

    // Row 2: Secondary actions
    buttons.push([
      {
        text: '👁️ Мониторить',
        callback_data: `sentinel_monitor:${alert.productId}`,
      },
      {
        text: '🚫 Игнорировать',
        callback_data: `sentinel_ignore:${alert.productId}`,
      },
    ]);

    // Row 3: Info
    buttons.push([
      {
        text: '📊 Подробная аналитика',
        callback_data: `sentinel_details:${alert.productId}`,
      },
    ]);

    return buttons;
  }

  /**
   * Send message to Telegram with inline keyboard
   */
  private async sendMessage(
    chatId: number,
    text: string,
    buttons?: InlineButton[][]
  ): Promise<void> {
    const token = config.TELEGRAM_BOT_TOKEN;
    const url = `${TELEGRAM_API}${token}/sendMessage`;

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    if (buttons && buttons.length > 0) {
      body.reply_markup = {
        inline_keyboard: buttons,
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${error}`);
    }
  }

  /**
   * Send batch alerts (grouped)
   */
  async sendBatchAlerts(chatId: number, alerts: CompetitorAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    // Send summary first
    const summary = this.formatBatchSummary(alerts);
    await this.sendMessage(chatId, summary);

    // Send individual alerts (max 3 to avoid spam)
    const topAlerts = alerts.slice(0, 3);
    for (const alert of topAlerts) {
      await this.sendAlert(chatId, alert);
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If more than 3, send "see more" message
    if (alerts.length > 3) {
      const moreMessage = `\n📋 <i>Ещё ${alerts.length - 3} алертов. Используйте /sentinel для просмотра всех.</i>`;
      await this.sendMessage(chatId, moreMessage);
    }
  }

  /**
   * Format batch summary
   */
  private formatBatchSummary(alerts: CompetitorAlert[]): string {
    const critical = alerts.filter(a => a.recommendedAction === 'lower_price').length;
    const warning = alerts.filter(a => a.recommendedAction === 'monitor').length;

    let message = '🛡️ <b>SENTINEL REPORT</b>\n\n';
    message += `📊 Всего алертов: <b>${alerts.length}</b>\n`;
    if (critical > 0) {
      message += `🚨 Критичных: <b>${critical}</b>\n`;
    }
    if (warning > 0) {
      message += `⚠️ Предупреждений: <b>${warning}</b>\n`;
    }
    message += '\n<i>Детали ниже ↓</i>';

    return message;
  }
}

// Singleton
export const sentinelTelegram = new SentinelTelegram();
