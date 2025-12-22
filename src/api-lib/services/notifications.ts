// ============================================
// NeuroGUARDIAN — Notification Service
// Telegram notifications and reminders
// ============================================

import { TELEGRAM_BOT_TOKEN } from '../lib/constants.js';
import { getUsersWithExpiringSubscriptions, markReminderSent } from './database.js';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Send Telegram notification to user
 */
export async function sendTelegramNotification(userId: number, message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to send notification to ${userId}:`, error);
      return false;
    }

    console.log(`✅ Notification sent to ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error sending notification to ${userId}:`, error);
    return false;
  }
}

/**
 * Send subscription expiry reminders
 * Called by cron job
 */
export async function sendExpiryReminders(): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  try {
    // Get users with subscriptions expiring in 3 days
    const users = await getUsersWithExpiringSubscriptions(3);

    for (const user of users) {
      const daysLeft = Math.ceil(
        (new Date(user.subscription_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      const message =
        daysLeft <= 0
          ? `⚠️ *Ваша подписка NeuroGUARDIAN истекла!*\n\nЗащита ваших товаров отключена. Продлите подписку, чтобы продолжить защищать маржу.`
          : `⏰ *Напоминание: подписка истекает через ${daysLeft} ${getDaysWord(daysLeft)}*\n\nПродлите подписку NeuroGUARDIAN, чтобы защита работала непрерывно.`;

      const success = await sendTelegramNotification(user.id, message);

      if (success) {
        sent++;
        await markReminderSent(user.id);
      } else {
        errors++;
      }
    }
  } catch (error) {
    console.error('Error sending expiry reminders:', error);
    errors++;
  }

  return { sent, errors };
}

/**
 * Send protection trigger notification
 */
export async function sendProtectionAlert(
  userId: number,
  productTitle: string,
  detectedPrice: number,
  minPrice: number,
  action: 'zero_stock' | 'price_correction',
  savedAmount: number
): Promise<boolean> {
  const actionText = action === 'zero_stock' ? '🛑 Товар снят с продажи' : '🔄 Цена восстановлена';

  const message =
    `🛡️ *SENTINEL ЗАЩИТА СРАБОТАЛА*\n\n` +
    `📦 ${productTitle}\n` +
    `💰 Обнаружена цена: ${detectedPrice}₽\n` +
    `⚡ Минимум Stop-Loss: ${minPrice}₽\n\n` +
    `${actionText}\n` +
    `💵 Сохранено: ${savedAmount}₽`;

  return sendTelegramNotification(userId, message);
}

/**
 * Helper: get correct Russian word for days
 */
function getDaysWord(days: number): string {
  if (days === 1) return 'день';
  if (days >= 2 && days <= 4) return 'дня';
  return 'дней';
}
