// ============================================
// NeuroGUARDIAN — Notification Service
// Telegram notifications for alerts and reports
// ============================================

import { sql } from './database.js';
import { logOpsEvent } from './ops-logger.js';
import { llmRouter } from '../../infrastructure/llm/LLMRouter.js';
import { getSecret } from '../lib/secrets-helper.js';

// ============================================
// TYPES
// ============================================

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

export type AlertType =
  | 'price_protection'
  | 'sentinel_alert'
  | 'margin_warning' // NEW: Low margin alert
  | 'stock_warning' // NEW: Low stock alert
  | 'competitor_alert' // NEW: Competitor price drop
  | 'system_alert' // NEW: System health alerts from Kernel
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

async function getAdminChatId(): Promise<string> {
  const chatId = await getSecret('admin_chat_id', 'notification_delivery');
  if (!chatId) {
    console.warn('ADMIN_CHAT_ID not configured (DB or ENV), notifications will be skipped');
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
 *
 * OPTIMIZATION: In our schema, users.id IS the Telegram user ID (BIGINT PRIMARY KEY).
 * There is NO separate telegram_id column.
 *
 * We only need to verify the user EXISTS in the database once, then cache it.
 */
const chatIdCache = new Map<number, string>();
const nonExistentUsers = new Set<number>(); // Track users we've already checked don't exist

async function getUserChatId(userId: number): Promise<string | null> {
  // Fast path: already cached
  const cached = chatIdCache.get(userId);
  if (cached) return cached;

  // Fast path: we already know this user doesn't exist
  if (nonExistentUsers.has(userId)) {
    return null;
  }

  // Verify user exists in database (only check once, then cache)
  let retries = 3;
  while (retries > 0) {
    try {
      // Quick existence check - more efficient than SELECT *
      const result = await sql`SELECT 1 FROM users WHERE id = ${userId} LIMIT 1`;

      if (result.rows.length === 0) {
        console.warn(`[Notifications] User ${userId} not found in database`);
        nonExistentUsers.add(userId);
        return null;
      }

      // User exists! Cache the chat ID (which is the same as user ID)
      const tidString = userId.toString();
      chatIdCache.set(userId, tidString);
      return tidString;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('Failed to verify user exists after 3 retries:', error);
        return null;
      }
      console.warn(`⚠️ Retrying DB check for user ${userId}... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return null;
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

  // Price Protection - action ALREADY executed by Sentinel, no confirmation needed
  // Just show a link to view the product
  if (alert.type === 'price_protection' && alert.product) {
    const { externalId, marketplace } = alert.product;

    // Only show link to product on marketplace
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
 * TEMPORARILY DISABLED - Local LLM not running, use templates instead
 */
async function generateSmartMessage(alert: Alert): Promise<string | null> {
  // TEMP: Skip LLM call to avoid timeouts when local LLM is not running
  // Re-enable when Groq or other cloud LLM is configured
  // return null; // This line was commented out as per the instruction to enable LLM

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

  const systemPrompt = `Ты — Виктор, ИИ-управляющий магазинами на WB и Ozon.
Твоя задача: написать уведомление для продавца.
Стиль: уверенный, профессиональный, как отчет о проделанной работе.

КРИТИЧЕСКИ ВАЖНО:
Если тип уведомления "price_protection" (защита цен) — это значит, что СИСТЕМА УЖЕ ИЗМЕНИЛА ЦЕНУ (или обнулила остатки).
Твоя задача — не "рекомендовать", а ПОДТВЕРДИТЬ действие.
Примеры хороших фраз: "Я скорректировал цену", "Защита сработала, цена обновлена", "Вернул цену на место".
Примеры ПЛОХИХ фраз: "Рекомендую поднять", "Нужно изменить", "Обратите внимание".

Если тип "sentinel_alert" — это предупреждение, тут уместны советы.

Формат: Telegram Markdown.
Ограничение: до 350 символов.
Не используй слова: API, Sentinel, webhook.
Сразу к сути.`;

  const context = [
    `Тип: ${alert.type}`,
    `Товар: ${alert.product?.name || 'Н/Д'}`,
    `Маркетплейс: ${alert.product?.marketplace || 'Н/Д'}`,
    `Анализ: ${alert.analysis ? JSON.stringify(alert.analysis) : alert.message || 'анализ не предоставлен'}`,
    `Доп. текст: ${alert.message || ''}`,
  ].join('\n');

  const userPrompt = `На основе этих данных напиши отчет для селлера.
Если это price_protection — четко подтверди, что цена УЖЕ изменена для защиты маржи.
Если это демпинг (competitor_alert) — объясни опасность.
Если это приветствие — вдохнови на продажи.
Данные:\n${context}`;

  try {
    const response = await llmRouter.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.7,
        maxTokens: 500,
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
    let header = `🤖 *Виктор ИИ*`;
    if (alert.type === 'welcome') header = `👋 *Виктор ИИ — Ваш управляющий*`;
    if (alert.type === 'subscription_expired') header = `💎 *Виктор ИИ: Подписка истекла*`;
    if (alert.type === 'price_protection') header = `🛡️ *Виктор ИИ — Защита цен*`;

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

  // Price protection alert - СТОРОЖ FORMAT (3 SCENARIOS)
  if (alert.type === 'price_protection' && alert.analysis && alert.product) {
    const mpEmoji = alert.product.marketplace.toUpperCase() === 'WB' ? '🟣' : '🔵';
    const currentPrice = alert.analysis.currentPrice;
    const minPrice = alert.analysis.recommendedPrice;
    const wasBelow = currentPrice < minPrice;
    const difference = Math.abs(minPrice - currentPrice);

    // Короткое название (макс 60 символов)
    const shortTitle =
      alert.product.name.length > 60
        ? alert.product.name.substring(0, 57) + '...'
        : alert.product.name;

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    let headerEmoji = '';
    let headerText = '';
    let priceBlock = '';
    let resultBlock = '';
    let tipText = '';

    if (wasBelow) {
      // СЦЕНАРИЙ 1: Реальная атака — цена была НИЖЕ минимума
      headerEmoji = '🚨';
      headerText = 'ЦЕНУ СНИЗИЛИ — МЫ ВЕРНУЛИ';
      priceBlock = [
        `💸 *Было:* ~${currentPrice}₽~ (на ${difference}₽ ниже)`,
        `✅ *Стало:* ${minPrice}₽`,
      ].join('\n');
      resultBlock = `💰 *Защитили:* ${difference}₽`;
      tipText = 'Проверьте конкурентов';
    } else if (difference === 0) {
      // СЦЕНАРИЙ 2: Превентивная защита — цена РАВНА минимуму
      headerEmoji = '✅';
      headerText = 'ЗАЩИТА СРАБОТАЛА';
      priceBlock = [`💰 *Цена:* ${minPrice}₽`, `🔒 *Статус:* Зафиксирована на минимуме`].join('\n');
      resultBlock = `🛡️ *Результат:* Цена не упадёт ниже`;
      tipText = 'Всё под контролем';
    } else {
      // СЦЕНАРИЙ 3: Цена приближалась к минимуму
      headerEmoji = '⚠️';
      headerText = 'ЦЕНА ПРИБЛИЖАЛАСЬ К МИНИМУМУ';
      priceBlock = [`📊 *Было:* ${currentPrice}₽`, `🔒 *Защитили на:* ${minPrice}₽`].join('\n');
      resultBlock = `🛡️ *Результат:* Снижение остановлено`;
      tipText = 'Превентивная защита';
    }

    const actionLabel = alert.analysis.action === 'zero_stock' ? 'Остаток → 0' : 'Возврат цены';

    return [
      `🛡️ *СТОРОЖ*`,
      ``,
      `${headerEmoji} *${headerText}*`,
      ``,
      `${mpEmoji} ${alert.product.marketplace.toUpperCase()} • ${time}`,
      `📦 ${escapeMarkdown(shortTitle)}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      priceBlock,
      ``,
      `⚔️ *Действие:* ${actionLabel}`,
      resultBlock,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `✅ *Товар защищён!* 💡 _${tipText}_`,
    ].join('\n');
  }

  // Sentinel alert - УЛУЧШЕННЫЙ ФОРМАТ
  if (alert.type === 'sentinel_alert' && alert.product) {
    const mpEmoji = alert.product.marketplace.toUpperCase() === 'WB' ? '🟣' : '🔵';
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Короткое название товара
    const shortTitle =
      alert.product.name.length > 50
        ? alert.product.name.substring(0, 47) + '...'
        : alert.product.name;

    const lines = [
      `⚠️ *СТОРОЖ — Обнаружена угроза*`,
      ``,
      `${mpEmoji} ${alert.product.marketplace.toUpperCase()} • ${time}`,
      `📦 ${escapeMarkdown(shortTitle)}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
    ];

    // Добавляем информацию о цене если есть
    if (alert.data?.livePrice) {
      const livePrice = alert.data.livePrice as number;
      lines.push(`💰 *Текущая цена:* ${livePrice}₽`);

      // Если есть min_price в данных
      if (alert.data?.minPrice) {
        const minPrice = alert.data.minPrice as number;
        const diff = minPrice - livePrice;
        if (diff > 0) {
          lines.push(`🔻 *Ниже минимума на:* ${diff}₽`);
        }
      }
      lines.push(``);
    }

    // Сообщение об угрозе
    lines.push(alert.message || '⚠️ Обнаружено изменение цены');
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`💡 _Проверьте товар и настройки защиты_`);

    return lines.join('\n');
  }

  // Welcome message
  if (alert.type === 'welcome') {
    return [
      `👋 *Привет! Я Виктор — ваш ИИ-управляющий*`,
      ``,
      alert.message || 'Буду следить за вашим магазином на WB и Ozon.',
      ``,
      `🛡️ Защита цен • 📊 Аналитика • ⚠️ Уведомления`,
    ].join('\n');
  }

  // === NEW PROACTIVE ALERTS ===

  // Margin warning - low margin alert
  if (alert.type === 'margin_warning' && alert.product) {
    const margin = (alert.data?.margin as number) || 0;
    const profit = (alert.data?.profit as number) || 0;
    return [
      `💸 *Виктор ИИ — Внимание к марже!*`,
      ``,
      `${emoji} *Низкая маржинальность*`,
      ``,
      `📦 *${escapeMarkdown(alert.product.name)}*`,
      `🏷️ Артикул: \`${alert.product.externalId}\``,
      ``,
      `📊 Маржа: *${margin.toFixed(1)}%*`,
      `💰 Прибыль: *${profit}₽* за шт.`,
      ``,
      `💡 ${alert.message || 'Рекомендую пересмотреть цену или себестоимость'}`,
    ].join('\n');
  }

  // Stock warning - low stock alert
  if (alert.type === 'stock_warning' && alert.product) {
    const stock = (alert.data?.stock as number) || 0;
    const daysLeft = (alert.data?.daysLeft as number) || 0;
    return [
      `📦 *Виктор ИИ — Остатки заканчиваются!*`,
      ``,
      `${emoji} *Скоро закончится товар*`,
      ``,
      `📦 *${escapeMarkdown(alert.product.name)}*`,
      `🏷️ Артикул: \`${alert.product.externalId}\``,
      ``,
      `📊 Остаток: *${stock} шт.*`,
      `⏰ Хватит на: *~${daysLeft} дн.*`,
      ``,
      `💡 ${alert.message || 'Закажите товар на склад, чтобы не потерять продажи!'}`,
    ].join('\n');
  }

  // Competitor alert - competitor price drop
  if (alert.type === 'competitor_alert' && alert.product) {
    const competitorPrice = (alert.data?.competitorPrice as number) || 0;
    const yourPrice = (alert.data?.yourPrice as number) || 0;
    const diff = yourPrice - competitorPrice;
    return [
      `🔍 *Виктор ИИ — Конкурент снизил цену!*`,
      ``,
      `${emoji} *Изменение у конкурента*`,
      ``,
      `📦 *${escapeMarkdown(alert.product.name)}*`,
      `🏷️ Ваш артикул: \`${alert.product.externalId}\``,
      ``,
      `💰 Ваша цена: *${yourPrice}₽*`,
      `👤 Конкурент: *${competitorPrice}₽*`,
      diff > 0 ? `📉 Разница: *${diff}₽* дороже` : `📈 Разница: *${Math.abs(diff)}₽* дешевле`,
      ``,
      `💡 ${alert.message || 'Проверьте, нужно ли скорректировать цену'}`,
    ].join('\n');
  }

  // System alert (from Kernel health monitoring)
  if (alert.type === 'system_alert') {
    return [
      `🚨 *СИСТЕМА — КРИТИЧЕСКАЯ СИТУАЦИЯ*`,
      ``,
      `${emoji} ${alert.message || 'Обнаружена проблема в системе'}`,
      ``,
      `💡 _Проверьте /api?action=health для диагностики_`,
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
  const adminChatId = await getAdminChatId();
  console.log(
    `[Notification] Sending Admin Alert: Type=${alert.type}, ID=${adminChatId ? 'OK' : 'MISSING'}`
  );

  if (!adminChatId) {
    console.warn('[Notification] FAILED: Admin Chat ID not configured');
    return false;
  }

  try {
    let message: string;

    // SPECIAL CASE: Sentinel Reports (already pre-formatted)
    // If it's a sentinel_alert without a specific product, use the raw message
    if (alert.type === 'sentinel_alert' && !alert.product && alert.message) {
      message = alert.message;
    } else {
      // Standard flow
      let smartMsg: string | null = null;
      try {
        // Try getting smart message (skip for simple status updates)
        smartMsg = await generateSmartMessage(alert);
      } catch (e) {
        console.warn('[Notification] Smart message generation failed, falling back to template', e);
      }
      message = formatAlert(alert, smartMsg);
    }

    const replyMarkup = getAlertButtons(alert);

    console.log(`[Notification] Sending to Telegram... (Length: ${message.length})`);
    const success = await sendTelegramMessage(adminChatId, message, {
      replyMarkup: replyMarkup as Record<string, unknown>,
    });

    console.log(`[Notification] Send Result: ${success ? 'SUCCESS' : 'FAILED'}`);

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
  } catch (error) {
    console.error('[Notification] CRITICAL ERROR sending admin alert:', error);
    return false;
  }
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
 * Send alert - routes to user if userId provided, otherwise to admin
 * FIXED: Removed duplication (was sending to both admin AND user for high urgency)
 */
export async function sendAlert(alert: Alert): Promise<boolean> {
  // If alert has a specific user, send to that user only
  if (alert.product?.userId) {
    return await sendAlertToUser(alert.product.userId, alert);
  }

  // Otherwise send to admin (system-wide alerts)
  return await sendAlertToAdmin(alert);
}

/**
 * Send hourly report to admin — ONLY if there are issues
 * Silent when everything is OK (no spam!)
 */
export async function sendHourlyReport(report: HourlyReport): Promise<boolean> {
  const adminChatId = await getAdminChatId();
  if (!adminChatId) return false;

  const hasErrors = report.errors && report.errors.length > 0;
  const hasAlerts = report.alertsSent > 0;

  // 🔇 SILENT MODE: Don't spam if everything is OK
  if (!hasErrors && !hasAlerts) {
    console.log('📊 Hourly check: всё в порядке, уведомление не отправляем');
    return true; // Success but no message
  }

  // Only send if there's something important
  const lines: string[] = [`🤖 *Виктор ИИ — Проверка*`, ``];

  if (hasAlerts) {
    lines.push(`⚠️ За последний час: ${report.alertsSent} важных событий`);
    lines.push(`Проверено товаров: ${report.priceChecks}`);
  }

  if (hasErrors) {
    lines.push(``);
    lines.push(`❌ Ошибок: ${report.errors!.length}`);
    lines.push(`Возможно проблема с доступом к маркетплейсу`);
  }

  if (report.autoUpdates > 0) {
    lines.push(``);
    lines.push(`✅ Автоматически исправлено: ${report.autoUpdates} цен`);
  }

  const message = lines.join('\n');
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
  const adminChatId = await getAdminChatId();
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
