// ============================================
// NeuroGUARDIAN — Notification Service
// Telegram notifications for alerts and reports
// ============================================

import { sql } from '@vercel/postgres';
import { logOpsEvent } from './ops-logger.js';

// ============================================
// TYPES
// ============================================

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

export type AlertType =
  | 'price_protection'
  | 'sentinel_alert'
  | 'system_error'
  | 'sync_completed'
  | 'daily_report'
  | 'hourly_report'
  | 'subscription_expired'
  | 'welcome';

export interface Alert {
  type: AlertType;
  urgency: AlertUrgency;
  message?: string;
  product?: {
    name: string;
    marketplace: string;
    externalId: string;
    userId?: number;
  };
  analysis?: {
    currentPrice: number;
    recommendedPrice: number;
    reason: string;
    action: string;
  };
  data?: Record<string, unknown>;
}

export interface HourlyReport {
  productsSynced: number;
  priceChecks: number;
  autoUpdates: number;
  alertsSent: number;
  errors?: string[];
}

// ============================================
// TELEGRAM HELPERS
// ============================================

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }
  return token;
}

function getAdminChatId(): string {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!chatId) {
    console.warn('ADMIN_CHAT_ID not configured, notifications will be skipped');
    return '';
  }
  return chatId;
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    disableNotification?: boolean;
    replyMarkup?: Record<string, unknown>;
  }
): Promise<boolean> {
  if (!chatId) {
    console.warn('No chat ID provided, skipping notification');
    return false;
  }

  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || 'Markdown',
        disable_notification: options?.disableNotification || false,
        reply_markup: options?.replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Get user's Telegram chat ID from database
 */
async function getUserChatId(userId: number): Promise<string | null> {
  try {
    const result = await sql`SELECT id FROM users WHERE id = ${userId}`;
    return result.rows[0]?.id?.toString() || null;
  } catch (error) {
    console.error('Failed to get user chat ID:', error);
    return null;
  }
}

// ============================================
// ALERT FORMATTING
// ============================================

const URGENCY_EMOJI: Record<AlertUrgency, string> = {
  low: 'ℹ️',
  medium: '⚠️',
  high: '🔶',
  critical: '🚨',
};

function formatAlert(alert: Alert): string {
  const emoji = URGENCY_EMOJI[alert.urgency];

  // Price protection alert
  if (alert.type === 'price_protection' && alert.analysis && alert.product) {
    return [
      `${emoji} *Price Alert: ${escapeMarkdown(alert.product.name)}*`,
      ``,
      `📍 Маркетплейс: ${alert.product.marketplace}`,
      `💰 Текущая цена: ${alert.analysis.currentPrice}₽`,
      `📊 Рекомендация: ${alert.analysis.recommendedPrice}₽`,
      ``,
      `📝 Причина: ${escapeMarkdown(alert.analysis.reason)}`,
      `🎯 Действие: ${alert.analysis.action}`,
    ].join('\n');
  }

  // Sentinel alert
  if (alert.type === 'sentinel_alert' && alert.product) {
    return [
      `${emoji} *Sentinel Alert*`,
      ``,
      `📦 ${escapeMarkdown(alert.product.name)}`,
      `📍 ${alert.product.marketplace}`,
      ``,
      alert.message || 'Обнаружена нежелательная акция',
    ].join('\n');
  }

  // System error
  if (alert.type === 'system_error') {
    return [`${emoji} *System Error*`, ``, alert.message || 'Произошла системная ошибка'].join(
      '\n'
    );
  }

  // Default format
  return `${emoji} *${alert.type}*\n\n${alert.message || 'No details'}`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

/**
 * Send alert to admin
 */
export async function sendAlertToAdmin(alert: Alert): Promise<boolean> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) return false;

  const message = formatAlert(alert);
  const success = await sendTelegramMessage(adminChatId, message);

  // Log notification
  await logOpsEvent({
    eventType: 'notification_sent',
    eventSource: 'system',
    payload: {
      alertType: alert.type,
      urgency: alert.urgency,
      success,
      recipient: 'admin',
    },
  });

  return success;
}

/**
 * Send alert to user
 */
export async function sendAlertToUser(userId: number, alert: Alert): Promise<boolean> {
  const chatId = await getUserChatId(userId);
  if (!chatId) {
    console.warn(`No chat ID for user ${userId}, skipping notification`);
    return false;
  }

  const message = formatAlert(alert);
  const success = await sendTelegramMessage(chatId, message);

  // Log notification
  await logOpsEvent({
    eventType: 'notification_sent',
    eventSource: 'system',
    userId,
    payload: {
      alertType: alert.type,
      urgency: alert.urgency,
      success,
    },
  });

  return success;
}

/**
 * Send alert - routes to admin for critical, user for others
 */
export async function sendAlert(alert: Alert): Promise<boolean> {
  // Critical alerts always go to admin
  if (alert.urgency === 'critical' || alert.urgency === 'high') {
    await sendAlertToAdmin(alert);
  }

  // Also send to user if applicable
  if (alert.product?.userId) {
    return await sendAlertToUser(alert.product.userId, alert);
  }

  // Default to admin
  return await sendAlertToAdmin(alert);
}

/**
 * Send hourly report to admin
 */
export async function sendHourlyReport(report: HourlyReport): Promise<boolean> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) return false;

  const hasErrors = report.errors && report.errors.length > 0;
  const emoji = hasErrors ? '⚠️' : '📊';

  const message = [
    `${emoji} *Hourly Report*`,
    ``,
    `⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`,
    ``,
    `📦 Products synced: ${report.productsSynced}`,
    `✅ Price checks: ${report.priceChecks}`,
    `✏️ Auto-updates: ${report.autoUpdates}`,
    `⚠️ Alerts sent: ${report.alertsSent}`,
    ``,
    hasErrors ? `❌ Errors: ${report.errors!.length}` : `✅ No errors`,
  ].join('\n');

  const success = await sendTelegramMessage(adminChatId, message);

  await logOpsEvent({
    eventType: 'notification_sent',
    eventSource: 'system',
    payload: {
      reportType: 'hourly',
      success,
      ...report,
    },
  });

  return success;
}

/**
 * Send daily report to admin
 */
export async function sendDailyReport(stats: {
  totalProducts: number;
  totalPriceChanges: number;
  totalAlerts: number;
  totalErrors: number;
  topProducts?: Array<{ name: string; changes: number }>;
}): Promise<boolean> {
  const adminChatId = getAdminChatId();
  if (!adminChatId) return false;

  const message = [
    `📈 *Daily Report*`,
    ``,
    `📅 ${new Date().toLocaleDateString('ru-RU')}`,
    ``,
    `📦 Total products: ${stats.totalProducts}`,
    `✏️ Price changes: ${stats.totalPriceChanges}`,
    `⚠️ Alerts: ${stats.totalAlerts}`,
    `❌ Errors: ${stats.totalErrors}`,
    ``,
    stats.topProducts && stats.topProducts.length > 0
      ? `🏆 *Top Products (by changes):*\n${stats.topProducts.map((p, i) => `${i + 1}. ${escapeMarkdown(p.name)}: ${p.changes}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return await sendTelegramMessage(adminChatId, message);
}

/**
 * Send welcome message to new user
 */
export async function sendWelcomeMessage(userId: number, userName: string): Promise<boolean> {
  const chatId = await getUserChatId(userId);
  if (!chatId) return false;

  const message = [
    `👋 *Добро пожаловать в NeuroGUARDIAN!*`,
    ``,
    `Привет, ${escapeMarkdown(userName)}!`,
    ``,
    `🧠 AI-агент готов помочь вам управлять товарами на маркетплейсах.`,
    ``,
    `🚀 Начните с добавления API-ключей в настройках.`,
  ].join('\n');

  return await sendTelegramMessage(chatId, message);
}

// ============================================
// EXPORT
// ============================================

export const notificationService = {
  sendAlert,
  sendAlertToAdmin,
  sendAlertToUser,
  sendHourlyReport,
  sendDailyReport,
  sendWelcomeMessage,
  sendTelegramNotification,
};

/**
 * Legacy compatibility wrapper (simple text message)
 */
export async function sendTelegramNotification(userId: number, message: string): Promise<boolean> {
  const chatId = await getUserChatId(userId);
  if (!chatId) return false;
  return sendTelegramMessage(chatId, message, { parseMode: 'HTML' });
}

export default notificationService;
