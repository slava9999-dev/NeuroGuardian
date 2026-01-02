// ============================================
// NeuroGUARDIAN — Notification Service
// Telegram notifications for alerts and reports
// ============================================

import { sql } from '@vercel/postgres';
import { logOpsEvent } from './ops-logger.js';
import { callLLMWithFallback } from '../agent/orchestrator-v4.js';

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

function escapeMarkdown(text: string): string {
  // Only escape characters that are special in MarkdownV2 UNLESS inside code blocks
  // For basic Markdown (which we use), we need less escaping
  return text.replace(/[_*`[\]]/g, '\\$&');
}

/**
 * Generate smart action buttons for alerts
 * Uses two-step confirmation for price changes (confirm:apply_price)
 */
function getAlertButtons(alert: Alert): Record<string, unknown> | undefined {
  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [];

  // Price Protection Actions - TWO-STEP CONFIRMATION
  if (alert.type === 'price_protection' && alert.product && alert.analysis) {
    const { recommendedPrice } = alert.analysis;
    const { externalId, marketplace } = alert.product;

    // Row 1: Confirm Apply + Ignore
    buttons.push([
      {
        text: `✅ Применить ${recommendedPrice}₽`,
        // confirm: prefix triggers confirmation dialog
        callback_data: `confirm:apply_price:${marketplace}:${externalId}:${recommendedPrice}`,
      },
      {
        text: `❌ Игнорировать`,
        callback_data: `ignore_alert:${externalId}`,
      },
    ]);

    // Row 2: View Product Link
    const link =
      marketplace.toLowerCase() === 'wb'
        ? `https://www.wildberries.ru/catalog/${externalId}/detail.aspx`
        : `https://www.ozon.ru/product/${externalId}`;

    buttons.push([{ text: '🔗 Открыть товар на маркетплейсе', url: link }]);
  }

  // Sentinel Alerts
  if (alert.type === 'sentinel_alert' && alert.product) {
    buttons.push([
      {
        text: '🛡️ Настроить защиту',
        callback_data: `check_protection:${alert.product.externalId}`,
      },
      {
        text: `❌ Игнорировать`,
        callback_data: `ignore_alert:${alert.product.externalId}`,
      },
    ]);
  }

  // Subscription Alerts
  if (alert.type === 'subscription_expired') {
    buttons.push([
      {
        text: '💎 Продлить подписку',
        callback_data: 'buy_subscription',
      },
    ]);
  }

  return buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
}

/**
 * Generate a smart, contextual message using LLM
 */
async function generateSmartMessage(alert: Alert): Promise<string | null> {
  // Only for relevant alert types
  const smartTypes: AlertType[] = [
    'price_protection',
    'sentinel_alert',
    'subscription_expired',
    'welcome',
  ];
  if (!smartTypes.includes(alert.type)) {
    return null;
  }

  const systemPrompt = `Ты — Виктор, опытный AI-ассистент для управления бизнесом на WB и Ozon.
Твоя задача: написать короткое, профессиональное и "живое" уведомление.
Стиль: деловой, партнерский, иногда с легким юмором или мотивацией, если это уместно (например, приветствие или успех).
Обязательно делай акцент на выгоде пользователя и ПРИБЫЛИ.
Формат: Telegram Markdown.
Ограничение: до 400 символов.
Не используй вводные фразы ("Вот уведомление:", "Согласно данным..."). Сразу к сути.`;

  const context = [
    `Тип: ${alert.type}`,
    `Товар: ${alert.product?.name || 'Н/Д'}`,
    `Маркетплейс: ${alert.product?.marketplace || 'Н/Д'}`,
    `Анализ: ${alert.analysis ? JSON.stringify(alert.analysis) : alert.message || 'анализ не предоставлен'}`,
    `Доп. текст: ${alert.message || ''}`,
  ].join('\n');

  const userPrompt = `На основе этих данных напиши уведомление для селлера.
Если это демпинг — объясни опасность для маржи.
Если это приветствие — вдохнови на успешные продажи и укажи на важность настройки.
Если это подписка — напомни, что без защиты Sentinel бизнес уязвим.
Данные:\n${context}`;

  try {
    const response = await callLLMWithFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 500,
        preferredModel: 'llama-3.3-70b-versatile',
      }
    );

    return response.content;
  } catch (error) {
    console.warn(
      '[Notifications] Smart message generation failed, falling back to template',
      error
    );
    return null;
  }
}

function formatAlert(alert: Alert, smartMessage?: string | null): string {
  const emoji = URGENCY_EMOJI[alert.urgency];

  // If we have a smart message, use it with a proper header
  if (smartMessage) {
    let header = `🛡️ *SENTINEL — Уведомление*`;
    if (alert.type === 'welcome') header = `👋 *Добро пожаловать в NeuroGUARDIAN!*`;
    if (alert.type === 'subscription_expired') header = `💎 *Внимание: Подписка истекла*`;
    if (alert.type === 'price_protection') header = `🛡️ *SENTINEL — Автоматический мониторинг*`;

    const body = [header, ``, smartMessage];

    // Append product info if available
    if (alert.product) {
      body.push(``);
      body.push(`📦 *${escapeMarkdown(alert.product.name)}* (\`${alert.product.externalId}\`)`);
      if (alert.analysis) {
        body.push(
          `💰 Цена: *${alert.analysis.currentPrice}₽* → *${alert.analysis.recommendedPrice}₽*`
        );
      }
    }

    return body.join('\n');
  }

  // FALLBACK TEMPLATES (if LLM fails or type not supported for smart generation)

  // Price protection alert - ENHANCED UX
  if (alert.type === 'price_protection' && alert.analysis && alert.product) {
    const mpEmoji = alert.product.marketplace.toUpperCase() === 'WB' ? '🟣' : '🔵';
    const priceDiff = alert.analysis.currentPrice - alert.analysis.recommendedPrice;
    const priceDiffPercent = Math.round((priceDiff / alert.analysis.currentPrice) * 100);

    return [
      `🛡️ *SENTINEL — Автоматический мониторинг*`,
      ``,
      `${emoji} *Обнаружен демпинг конкурента!*`,
      ``,
      `📦 *Товар:* ${escapeMarkdown(alert.product.name)}`,
      `🔢 *Артикул:* \`${alert.product.externalId}\``,
      `${mpEmoji} *Маркетплейс:* ${alert.product.marketplace.toUpperCase()}`,
      ``,
      `💰 Ваша цена: *${alert.analysis.currentPrice}₽*`,
      `📉 Рекомендация: *${alert.analysis.recommendedPrice}₽* (${priceDiffPercent > 0 ? '-' : '+'}${Math.abs(priceDiffPercent)}%)`,
      ``,
      `💡 *Причина:* ${escapeMarkdown(alert.analysis.reason)}`,
    ].join('\n');
  }

  // Sentinel alert - general
  if (alert.type === 'sentinel_alert' && alert.product) {
    return [
      `🛡️ *SENTINEL — Уведомление*`,
      ``,
      `${emoji} ${escapeMarkdown(alert.product.name)}`,
      `🔢 Артикул: \`${alert.product.externalId}\``,
      `📍 ${alert.product.marketplace.toUpperCase()}`,
      ``,
      alert.message || 'Обнаружена нежелательная акция',
    ].join('\n');
  }

  // Welcome message
  if (alert.type === 'welcome') {
    return [
      `👋 *Добро пожаловать в NeuroGUARDIAN!*`,
      ``,
      alert.message || 'AI-ассистент готов к работе.',
    ].join('\n');
  }

  // System error
  if (alert.type === 'system_error') {
    return [
      `⚙️ *Системное уведомление*`,
      ``,
      `${emoji} ${alert.message || 'Произошла системная ошибка'}`,
    ].join('\n');
  }

  // Default format
  return `${emoji} *${alert.type}*\n\n${alert.message || 'No details'}`;
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

  const smartMsg = await generateSmartMessage(alert);
  const message = formatAlert(alert, smartMsg);
  const replyMarkup = getAlertButtons(alert);

  const success = await sendTelegramMessage(adminChatId, message, {
    replyMarkup: replyMarkup as Record<string, unknown>,
  });

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
    console.warn(`No Telegram chat ID found for user ${userId}`);
    return false;
  }

  // Log to ops DB
  if (alert.urgency === 'high' || alert.urgency === 'critical') {
    logOpsEvent({
      eventType: 'sentinel_alert',
      eventSource: 'sentinel',
      payload: { userId, type: alert.type, urgency: alert.urgency, product: alert.product },
    });
  }

  const smartMsg = await generateSmartMessage(alert);
  const message = formatAlert(alert, smartMsg);
  const replyMarkup = getAlertButtons(alert);

  const success = await sendTelegramMessage(chatId, message, {
    replyMarkup: replyMarkup as Record<string, unknown>,
  });

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
