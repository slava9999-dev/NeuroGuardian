// ============================================
// Notification Service
// Sends Telegram notifications to users
// ============================================

import { logger } from '../../utils/logger';
import type { TaskType, TaskResult } from '../queue/task.types';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface SendOptions {
  parseMode?: 'HTML' | 'Markdown';
  silent?: boolean;
  keyboard?: InlineKeyboard;
}

interface InlineKeyboard {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>
  >;
}

export class NotificationService {
  /**
   * Send a message to user via Telegram
   */
  async send(userId: number, message: string, options: SendOptions = {}): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) {
      logger.warn('TELEGRAM_BOT_TOKEN not set, skipping notification');
      return false;
    }

    try {
      const payload: Record<string, unknown> = {
        chat_id: userId,
        text: message,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.silent || false,
        disable_web_page_preview: true,
      };

      if (options.keyboard) {
        payload.reply_markup = options.keyboard;
      }

      const response = await fetch(`${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Telegram API error', new Error(error), { userId });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to send notification', error, { userId });
      return false;
    }
  }

  /**
   * Send task completed notification
   */
  async sendTaskCompleted(
    userId: number,
    taskType: TaskType,
    result: TaskResult
  ): Promise<boolean> {
    const emoji = result.success ? '✅' : '❌';
    const title = this.getTaskTitle(taskType);

    const message = `${emoji} <b>${title}</b>\n\n${result.message}`;

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Send task failed notification (only after all retries)
   */
  async sendTaskFailed(userId: number, taskType: TaskType, error: string): Promise<boolean> {
    const title = this.getTaskTitle(taskType);

    const message =
      `❌ <b>Ошибка: ${title}</b>\n\n` +
      `Задача не выполнена после всех попыток.\n` +
      `Причина: ${error}\n\n` +
      `Попробуйте повторить позже.`;

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Send price alert notification
   */
  async sendPriceAlert(
    userId: number,
    productTitle: string,
    oldPrice: number,
    newPrice: number,
    competitor?: string
  ): Promise<boolean> {
    const priceDiff = newPrice - oldPrice;
    const percentDiff = ((priceDiff / oldPrice) * 100).toFixed(1);
    const direction = priceDiff > 0 ? '📈' : '📉';

    let message =
      `${direction} <b>Изменение цены</b>\n\n` +
      `<b>${productTitle}</b>\n` +
      `${oldPrice} ₽ → ${newPrice} ₽ (${priceDiff > 0 ? '+' : ''}${percentDiff}%)`;

    if (competitor) {
      message += `\n\n⚔️ Конкурент: ${competitor}`;
    }

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Send sentinel trigger notification
   */
  async sendSentinelTrigger(
    userId: number,
    productTitle: string,
    detectedPrice: number,
    minPrice: number,
    action: 'zero_stock' | 'correct_price',
    savedAmount: number
  ): Promise<boolean> {
    const actionText = action === 'zero_stock' ? '🛑 Остатки обнулены' : '✅ Цена восстановлена';

    const message =
      `🛡️ <b>Защита сработала!</b>\n\n` +
      `<b>${productTitle}</b>\n\n` +
      `⚠️ Обнаружена цена: ${detectedPrice} ₽\n` +
      `🔒 Min цена: ${minPrice} ₽\n\n` +
      `${actionText}\n` +
      `💰 Сохранено: ${savedAmount} ₽`;

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(
    userId: number,
    stats: {
      orders: number;
      revenue: number;
      triggers: number;
      savedAmount: number;
    }
  ): Promise<boolean> {
    const message =
      `📊 <b>Дневной отчёт</b>\n\n` +
      `📦 Заказов: <b>${stats.orders}</b>\n` +
      `💰 Выручка: <b>${stats.revenue.toLocaleString('ru-RU')} ₽</b>\n\n` +
      `🛡️ Защита сработала: <b>${stats.triggers}</b> раз\n` +
      `💵 Сохранено: <b>${stats.savedAmount.toLocaleString('ru-RU')} ₽</b>`;

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Send subscription expiry reminder
   */
  async sendExpiryReminder(
    userId: number,
    firstName: string,
    plan: string,
    daysLeft: number
  ): Promise<boolean> {
    const dayWord = daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней';

    const message =
      `⏰ <b>Напоминание о подписке</b>\n\n` +
      `Привет, ${firstName}!\n\n` +
      `Ваша подписка <b>${plan}</b> истекает через <b>${daysLeft} ${dayWord}</b>.\n\n` +
      `💡 Продлите сейчас, чтобы не потерять защиту товаров!\n\n` +
      `🔗 Откройте приложение для продления`;

    return this.send(userId, message, { parseMode: 'HTML' });
  }

  /**
   * Get human-readable task title
   */
  private getTaskTitle(taskType: TaskType): string {
    const titles: Record<TaskType, string> = {
      price_update: 'Обновление цен',
      bulk_stop_loss: 'Массовый Stop-Loss',
      competitor_scan: 'Сканирование конкурентов',
      sync_products: 'Синхронизация товаров',
      send_notification: 'Уведомление',
    };

    return titles[taskType] || taskType;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
