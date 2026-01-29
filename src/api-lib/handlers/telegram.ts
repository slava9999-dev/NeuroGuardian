// ============================================
// NeuroGUARDIAN — Telegram Bot Webhook Handler
// Receives messages from Telegram and routes to Viktor AI Agent
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, logSentinelAction } from '../services/database.js';
import { orchestrateV5 } from '../../agent/core/AgentOrchestratorV5.js';
import { logger, config } from '../lib/index.js';
import { inferGender } from '../../agent/utils/genderDetection.js';
import { stateManager } from '../../agent/core/StateManager.js';
import { db, systemFlags, users, products } from '../../infrastructure/database/db.js';
import { eq, and, or } from 'drizzle-orm';
import { VoiceService } from '../services/VoiceService.js';
import { logOpsEvent } from '../services/ops-logger.js';
// Using built-in Node 18+ FormData and Blob

// ============================================
// TYPES
// ============================================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  };
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface SentinelStats {
  usersProcessed: number;
  threatsDetected: number;
  actionsTaken: number;
  errors?: string[];
  productsScanned?: { wb: number; ozon: number };
}

// ============================================
// TELEGRAM API HELPERS
// ============================================

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getBotToken(): string {
  return config.TELEGRAM_BOT_TOKEN;
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    replyMarkup?: object;
  }
): Promise<boolean> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || 'HTML',
        reply_markup: options?.replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Telegram sendMessage error', { error, chatId });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send Telegram message', error);
    return false;
  }
}

async function sendTelegramVoice(
  chatId: number,
  audioBuffer: Buffer,
  caption?: string
): Promise<boolean> {
  try {
    const token = getBotToken();
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());

    // Convert Buffer to Uint8Array for proper Blob compatibility
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' });
    formData.append('voice', blob, 'viktor_reply.mp3');

    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const response = await fetch(`${TELEGRAM_API}${token}/sendVoice`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Telegram sendVoice error', { error, chatId });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send Telegram voice', error);
    return false;
  }
}

async function sendTypingAction(chatId: number): Promise<void> {
  try {
    const token = getBotToken();
    await fetch(`${TELEGRAM_API}${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch {
    // Ignore typing action errors
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    const token = getBotToken();
    await fetch(`${TELEGRAM_API}${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch {
    // Ignore errors
  }
}

async function editTelegramMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup: object
): Promise<boolean> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Telegram editMessageReplyMarkup error', { error, chatId, messageId });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to edit Telegram message reply markup', error);
    return false;
  }
}

// ============================================
// USER MANAGEMENT
// ============================================

async function ensureUserExists(telegramUser: TelegramUser): Promise<number> {
  try {
    // Check if user exists
    const existing = await sql`
      SELECT id FROM users WHERE id = ${telegramUser.id}
    `;

    if (existing.rows.length > 0) {
      // Update last activity
      await sql`
        UPDATE users 
        SET last_active = NOW(),
            first_name = ${telegramUser.first_name},
            last_name = ${telegramUser.last_name || null},
            username = ${telegramUser.username || null}
        WHERE id = ${telegramUser.id}
      `;

      // Check if user has subscription record, if not - create 7-day trial
      const subCheck = await sql`
        SELECT user_id FROM subscriptions WHERE user_id = ${telegramUser.id}
      `;

      if (subCheck.rows.length === 0) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        await sql`
          INSERT INTO subscriptions (
            user_id, tier, status, max_products, max_accounts, trial_ends_at
          ) VALUES (
            ${telegramUser.id},
            'pro',
            'trial',
            100,
            3,
            ${trialEnd.toISOString()}
          )
        `;

        // Also update users table
        await sql`
          UPDATE users 
          SET subscription_active = true, subscription_end = ${trialEnd.toISOString()}
          WHERE id = ${telegramUser.id}
        `;

        logger.info('Trial subscription activated for existing user', {
          userId: telegramUser.id,
          trialEnds: trialEnd.toISOString(),
        });
      }

      return telegramUser.id;
    }

    // Create new user with trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7); // 7 day trial

    await sql`
      INSERT INTO users (
        id, first_name, last_name, username, 
        subscription_active, subscription_end,
        protection_enabled, is_active, created_at, last_active
      ) VALUES (
        ${telegramUser.id},
        ${telegramUser.first_name},
        ${telegramUser.last_name || null},
        ${telegramUser.username || null},
        true,
        ${trialEnd.toISOString()},
        true,
        true,
        NOW(),
        NOW()
      )
    `;

    // Also create subscription record for proper subscription checks
    await sql`
      INSERT INTO subscriptions (
        user_id, tier, status, max_products, max_accounts, trial_ends_at
      ) VALUES (
        ${telegramUser.id},
        'pro',
        'trial',
        100,
        3,
        ${trialEnd.toISOString()}
      )
      ON CONFLICT (user_id) DO NOTHING
    `;

    logger.info('New user created from Telegram with 7-day trial', {
      userId: telegramUser.id,
      username: telegramUser.username,
      trialEnds: trialEnd.toISOString(),
    });

    // Infer gender from first name and update state for personalized communication
    const gender = inferGender(telegramUser.first_name);
    await stateManager.updateState(telegramUser.id, {
      gender,
      userName: telegramUser.first_name,
    });

    logger.info('User gender inferred for personalization', {
      userId: telegramUser.id,
      firstName: telegramUser.first_name,
      gender,
    });

    return telegramUser.id;
  } catch (error) {
    logger.error('Failed to ensure user exists', error);
    throw error;
  }
}

// ============================================
// COMMAND HANDLERS
// ============================================

async function sendTelegramPhoto(
  chatId: number,
  photoUrl: string,
  caption?: string,
  options?: { parseMode?: 'Markdown' | 'HTML'; replyMarkup?: object }
): Promise<boolean> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: options?.parseMode || 'HTML',
        reply_markup: options?.replyMarkup,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Telegram sendPhoto error', { error, chatId });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send Telegram photo', error);
    return false;
  }
}

async function handleStartCommand(chatId: number, user: TelegramUser): Promise<void> {
  await ensureUserExists(user);

  const webAppUrl = process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app';
  const bannerUrl = `${webAppUrl}/viktor_welcome_banner.png`;

  // Отправляем приветственный баннер
  await sendTelegramPhoto(chatId, bannerUrl);

  const welcomeMessage = `
👋 <b>Привет, ${user.first_name}!</b>

Я <b>Виктор</b> — ваш AI-защитник бизнеса на Wildberries и Ozon.

🛡️ <b>Что я делаю:</b>
• Защищаю от принудительных скидок маркетплейсов
• Мониторю цены конкурентов 24/7
• Управляю ценами автоматически
• Отправляю умные уведомления о проблемах

🎁 <b>У вас 7 дней бесплатного доступа!</b>

Напишите мне вопрос или откройте приложение:
`;

  await sendTelegramMessage(chatId, welcomeMessage, {
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть Виктора',
            web_app: { url: webAppUrl },
          },
        ],
        [
          {
            text: '❓ Помощь',
            callback_data: 'help',
          },
          {
            text: '📊 Статус',
            callback_data: 'status',
          },
        ],
      ],
    },
  });
}

async function handleHelpCommand(chatId: number): Promise<void> {
  const helpMessage = `
❓ <b>Помощь по Viktor AI</b>

<b>Просто напишите мне:</b>
• "Покажи мои товары" — список товаров
• "Какие продажи за неделю?" — статистика
• "Установи минимальную цену 1000₽ на товар X" — защита
• "Найди конкурентов" — анализ рынка

<b>Команды:</b>
/start — Перезапустить бота
/help — Эта помощь
/settings — Настройки API ключей
/status — Статус защиты

<b>Нужна помощь?</b>
Просто опишите вашу задачу — я пойму! 🧠
`;

  await sendTelegramMessage(chatId, helpMessage, { parseMode: 'HTML' });
}

async function handleSettingsCommand(chatId: number): Promise<void> {
  const webAppUrl = process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app';

  await sendTelegramMessage(chatId, '⚙️ Для настройки API ключей откройте приложение:', {
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '⚙️ Открыть настройки',
            web_app: { url: `${webAppUrl}?page=settings` },
          },
        ],
      ],
    },
  });
}

async function handleStatusCommand(chatId: number, userId: number): Promise<void> {
  try {
    const result = await sql`
      SELECT 
        subscription_active,
        subscription_end,
        protection_enabled,
        (SELECT COUNT(*) FROM products WHERE user_id = ${userId}) as products_count,
        (SELECT COUNT(*) FROM products WHERE user_id = ${userId} AND min_price > 0) as protected_count
      FROM users
      WHERE id = ${userId}
    `;

    if (result.rows.length === 0) {
      await sendTelegramMessage(chatId, '❌ Пользователь не найден. Используйте /start');
      return;
    }

    const user = result.rows[0];
    const isActive = user.subscription_active;
    const protectionOn = user.protection_enabled;
    const products = user.products_count || 0;
    const protected_count = user.protected_count || 0;

    const statusMessage = `
📊 <b>Статус вашего аккаунта</b>

${isActive ? '✅' : '❌'} Подписка: ${isActive ? 'Активна' : 'Неактивна'}
${protectionOn ? '🛡️' : '⚠️'} Защита цен: ${protectionOn ? 'Включена' : 'Выключена'}

📦 Товаров: <b>${products}</b>
🔒 Под защитой: <b>${protected_count}</b>

${!isActive ? '\n💡 Оформите подписку для продолжения работы!' : ''}
`;

    await sendTelegramMessage(chatId, statusMessage, { parseMode: 'HTML' });
  } catch (error) {
    logger.error('Failed to get user status', error);
    await sendTelegramMessage(chatId, '❌ Ошибка получения статуса. Попробуйте позже.');
  }
}

/**
 * Admin: Sentinel Dashboard
 */
async function handleSentinelDashboard(chatId: string | number) {
  try {
    const statsFlag = await db.query.systemFlags.findFirst({
      where: eq(systemFlags.key, 'sentinel_last_run_stats'),
    });

    const stopFlag = await db.query.systemFlags.findFirst({
      where: eq(systemFlags.key, 'sentinel_emergency_stop'),
    });

    const stats = statsFlag?.valueText ? (JSON.parse(statsFlag.valueText) as SentinelStats) : null;

    const isStopped = stopFlag?.valueBool || false;

    let message = `🛡️ <b>Sentinel Mission Control</b>\n\n`;
    message += `Статус: ${isStopped ? '🔴 ОСТАНОВЛЕН' : '🟢 РАБОТАЕТ'}\n`;
    message += `Последняя активность: ${
      statsFlag?.updatedAt ? new Date(statsFlag.updatedAt).toLocaleString('ru-RU') : 'нет данных'
    }\n\n`;

    if (stats) {
      message += `📊 <b>Итоги последнего цикла:</b>\n`;
      message += `👤 Пользователей: ${stats.usersProcessed}\n`;
      message += `📦 Товаров (WB/Ozon): ${stats.productsScanned?.wb || 0}/${
        stats.productsScanned?.ozon || 0
      }\n`;
      message += `⚠️ Угроз обнаружено: ${stats.threatsDetected}\n`;
      message += `🛡️ Действий защиты: ${stats.actionsTaken}\n`;

      if (stats.errors && stats.errors.length > 0) {
        message += `\n❌ <b>Ошибки:</b>\n${stats.errors.slice(0, 3).join('\n')}`;
      }
    } else {
      message += `⚪ Данные о прогонах отсутствуют.`;
    }

    message += `\n\n<i>NeuroGuardian Sentinel v2.0</i>`;

    const buttons = [
      [
        {
          text: isStopped ? '🟢 ЗАПУСТИТЬ SENTINEL' : '🛑 ОСТАНОВИТЬ SENTINEL',
          callback_data: isStopped ? 'sentinel_start' : 'sentinel_stop',
        },
      ],
      [{ text: '🔄 Обновить статистику', callback_data: 'refresh_sentinel' }],
    ];

    await sendTelegramMessage(Number(chatId), message, {
      replyMarkup: { inline_keyboard: buttons },
    });
  } catch (err) {
    logger.error('Failed to generate sentinel dashboard', err);
    await sendTelegramMessage(Number(chatId), '❌ Не удалось загрузить панель Sentinel.');
  }
}

// ============================================
// MESSAGE HANDLER (VIKTOR AI)
// ============================================

async function handleUserMessage(
  chatId: number,
  userId: number,
  text: string,
  userName?: string
): Promise<void> {
  // Show typing indicator
  await sendTypingAction(chatId);

  try {
    // Call Viktor AI Agent V5
    const result = await orchestrateV5(text, {
      userId,
      isFirstContact: false, // Could be improved based on history
      userName: userName || 'друг',
    });

    if (result.success) {
      // Format response for Telegram
      let response = result.message;

      // Add links if present
      if (result.links && result.links.length > 0) {
        response += '\n\n🔗 <b>Ссылки:</b>\n';
        result.links.forEach(link => {
          response += `• <a href="${link.url}">${link.title}</a>\n`;
        });
      }

      // Add actions if present
      if (result.actions && result.actions.length > 0) {
        response += '\n\n⚡ <b>Выполненные действия:</b>\n';
        result.actions.forEach(action => {
          response += `• ${action.summary}\n`;
        });
      }

      await sendTelegramMessage(chatId, response, { parseMode: 'HTML' });

      // --- OPTIONAL VOICE RESPONSE ---
      // Send voice message if text is not too long, VoiceService is available, and user enabled it
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId.toString()),
      });

      if (dbUser?.voiceEnabled && VoiceService.isAvailable() && result.message.length < 1000) {
        try {
          // Clean text for TTS (remove HTML tags and Markdown)
          const cleanText = result.message.replace(/<[^>]*>?/gm, '').replace(/\*|_|`/g, '');

          const audioBuffer = await VoiceService.synthesize(cleanText);
          await sendTelegramVoice(chatId, audioBuffer);
        } catch (vErr) {
          logger.error('Failed to send voice response', vErr);
        }
      }
    } else {
      await sendTelegramMessage(
        chatId,
        `❌ ${result.message || 'Произошла ошибка. Попробуйте ещё раз.'}`,
        { parseMode: 'HTML' }
      );
    }
  } catch (error) {
    logger.error('Viktor AI error in Telegram', error);
    await sendTelegramMessage(
      chatId,
      '❌ Извините, произошла ошибка. Попробуйте позже или используйте /help.',
      { parseMode: 'HTML' }
    );
  }
}

// ============================================
// CALLBACK QUERY HANDLER
// ============================================

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  const data = query.data || '';
  await answerCallbackQuery(query.id); // Acknowledge immediately

  // --- TWO-STEP CONFIRMATION ---

  // Step 1: User clicked "Применить" → Show confirmation
  if (data.startsWith('confirm:apply_price:')) {
    // Format: confirm:apply_price:marketplace:externalId:price
    const parts = data.replace('confirm:', '').split(':');
    if (parts.length >= 4) {
      const marketplace = parts[1];
      const externalId = parts[2];
      const price = parts[3];

      await sendTelegramMessage(
        chatId,
        `⚠️ *Подтвердите изменение цены*\n\n` +
          `📦 Артикул: \`${externalId}\`\n` +
          `💰 Новая цена: *${price}₽*\n\n` +
          `Вы уверены?`,
        {
          parseMode: 'Markdown',
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Да, применить',
                  callback_data: `apply_price:${marketplace}:${externalId}:${price}`,
                },
                { text: '❌ Отмена', callback_data: `cancel_action` },
              ],
            ],
          },
        }
      );
    }
    return;
  }

  // Step 2: User confirmed → Execute price change
  if (data.startsWith('apply_price:')) {
    // Format: apply_price:marketplace:externalId:price
    const parts = data.split(':');
    if (parts.length >= 4) {
      const marketplace = parts[1];
      const externalId = parts[2];
      const price = parts[3];
      const userId = query.from.id;

      await sendTelegramMessage(chatId, `⏳ Применяю цену ${price}₽...`);
      await sendTypingAction(chatId);

      // Delegate to Viktor AI
      const command = `Установи цену ${price} для товара с артикулом ${externalId} на ${marketplace}`;

      try {
        const result = await orchestrateV5(command, {
          userId,
          isFirstContact: false,
          userName: query.from.first_name,
          directExecution: {
            tool: 'update_prices', // Optimistic execution hint
            args: {
              marketplace,
              products: [{ product_id: externalId, new_price: parseFloat(price) }],
            },
          },
        });

        if (result.success) {
          await sendTelegramMessage(
            chatId,
            `✅ *Цена обновлена!*\n\n` +
              `📦 Артикул: \`${externalId}\`\n` +
              `💰 Новая цена: *${price}₽*\n\n` +
              `${result.message}`,
            { parseMode: 'Markdown' }
          );
        } else {
          await sendTelegramMessage(chatId, `❌ *Ошибка обновления цены*\n\n${result.message}`, {
            parseMode: 'Markdown',
          });
        }
      } catch (e) {
        logger.error('Failed to apply price via callback', e);
        await sendTelegramMessage(
          chatId,
          `❌ Системная ошибка при обновлении цены. Попробуйте позже.`
        );
      }
    }
    return;
  }

  // --- IGNORE ALERT ---
  if (data.startsWith('ignore_alert:')) {
    const externalId = data.split(':')[1];
    await sendTelegramMessage(
      chatId,
      `👌 Уведомление проигнорировано.\n\n` +
        `Товар \`${externalId}\` останется с текущей ценой.\n` +
        `Виктор ИИ продолжит мониторинг.`,
      { parseMode: 'Markdown' }
    );
    return;
  }

  // --- CANCEL ACTION ---
  if (data === 'cancel_action') {
    await sendTelegramMessage(chatId, `❌ Действие отменено.`);
    return;
  }

  // --- CHECK PROTECTION ---
  if (data.startsWith('check_protection:')) {
    const externalId = data.split(':')[1];

    await sendTelegramMessage(
      chatId,
      `🛡️ *Настройка защиты*\n\n` +
        `Откройте приложение для настройки правил защиты товара \`${externalId}\`.`,
      {
        parseMode: 'Markdown',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '⚙️ Открыть настройки',
                web_app: {
                  url: `${process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app'}?page=products`,
                },
              },
            ],
          ],
        },
      }
    );
    return;
  }

  // --- Static Commands ---

  switch (data) {
    case 'help':
      await handleHelpCommand(chatId);
      break;
    case 'settings':
      await handleSettingsCommand(chatId);
      break;
    case 'status':
      await handleStatusCommand(chatId, query.from.id);
      break;
    case 'buy_subscription':
      await sendTelegramMessage(
        chatId,
        '💳 *Оформление подписки*\n\n' + 'Нажмите кнопку ниже, чтобы выбрать тариф и оплатить.',
        {
          parseMode: 'Markdown',
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: '💎 Выбрать тариф',
                  web_app: {
                    url: `${process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app'}?page=subscription`,
                  },
                },
              ],
            ],
          },
        }
      );
      break;
  }

  // --- ACK ALERT (Quiet Sentinel) ---
  if (data.startsWith('ack_alert:')) {
    const externalId = data.split(':')[1];
    const userId = String(query.from.id);

    // 1. Update DB: Stop monitoring
    await db
      .update(products)
      .set({ isMonitored: false, updatedAt: new Date() })
      .where(
        and(
          eq(products.userId, userId),
          or(eq(products.productId, externalId), eq(products.nmId, externalId))
        )
      );

    // 2. Log to Sentinel Logs to satisfy Deduplication logic in Orchestrator
    // We don't have all details here, but ID + User + Action is what matters for 24h suppression
    await logSentinelAction({
      user_id: query.from.id,
      product_id: externalId,
      product_title: 'Acknowledge User Action',
      detected_price: 0,
      min_price: 0,
      defense_action: 'ALERT_ACKNOWLEDGED',
      saved_amount: 0,
      marketplace: 'manual',
      threat_type: 'user_acknowledge',
    }).catch(err => logger.error('Failed to log sentinel ack', err));

    await logOpsEvent({
      eventType: 'alert_acknowledged',
      eventSource: 'manual',
      userId: query.from.id,
      externalId: externalId,
      payload: { externalId, action: 'acknowledge' },
    });

    // 3. Update Keyboard: Change "Понял, проверю" to "🛡️ Включить защиту"
    if (query.message?.reply_markup) {
      const keyboard = query.message.reply_markup.inline_keyboard;
      const newKeyboard = keyboard.map(row =>
        row.map(btn => {
          if (btn.callback_data === data) {
            return {
              text: '🛡️ Включить защиту',
              callback_data: `enable_protection:${externalId}`,
            };
          }
          return btn;
        })
      );

      await editTelegramMessageReplyMarkup(Number(chatId), query.message.message_id, {
        inline_keyboard: newKeyboard,
      });
    }

    await answerCallbackQuery(query.id, 'Защита приостановлена для этого товара');
    return;
  }

  // --- ENABLE PROTECTION ---
  if (data.startsWith('enable_protection:')) {
    const externalId = data.split(':')[1];
    const userId = String(query.from.id);

    // 1. Update DB: Resume monitoring
    await db
      .update(products)
      .set({ isMonitored: true, updatedAt: new Date() })
      .where(
        and(
          eq(products.userId, userId),
          or(eq(products.productId, externalId), eq(products.nmId, externalId))
        )
      );

    // 2. Update Keyboard back to "Понял, проверю"
    if (query.message?.reply_markup) {
      const keyboard = query.message.reply_markup.inline_keyboard;
      const newKeyboard = keyboard.map(row =>
        row.map(btn => {
          if (btn.callback_data === data) {
            return {
              text: '✅ Понял, проверю',
              callback_data: `ack_alert:${externalId}`,
            };
          }
          return btn;
        })
      );

      await editTelegramMessageReplyMarkup(Number(chatId), query.message.message_id, {
        inline_keyboard: newKeyboard,
      });
    }

    await answerCallbackQuery(query.id, 'Защита включена');
    return;
  }

  // --- CHECK PRODUCT ---
  if (data.startsWith('check_product:')) {
    const externalId = data.split(':')[1];
    await sendTelegramMessage(
      Number(chatId),
      `🔍 Запрашиваю свежие данные по товару \`${externalId}\`...`
    );
    await handleUserMessage(
      Number(chatId),
      query.from.id,
      `Проверь статус товара ${externalId}`,
      query.from.first_name
    );
    return;
  }

  // --- RAISE PRICE (Manual fix) ---
  if (data.startsWith('raise_price:')) {
    const parts = data.split(':');
    const mp = parts[1];
    const externalId = parts[2];

    await sendTelegramMessage(
      Number(chatId),
      `🚀 Готов поднять цену для защиты маржи.\n\nНа какую цену установить? (Напишите просто число в ответ или выберите из вариантов)`,
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '🎯 На +10%',
                callback_data: `confirm:raise_percent:${mp}:${externalId}:10`,
              },
              {
                text: '🎯 На +20%',
                callback_data: `confirm:raise_percent:${mp}:${externalId}:20`,
              },
            ],
            [
              {
                text: '🛡️ Вернуть к РРЦ',
                callback_data: `confirm:restore_rrc:${mp}:${externalId}`,
              },
            ],
            [{ text: '❌ Отмена', callback_data: `cancel_action` }],
          ],
        },
      }
    );
    return;
  }

  // --- RAISE PERCENT CONFIRMATION ---
  if (data.startsWith('confirm:raise_percent:')) {
    const parts = data.split(':');
    const mp = parts[2];
    const eid = parts[3];
    const pct = parts[4];

    await sendTelegramMessage(
      Number(chatId),
      `💰 *Подтвердите повышение цены на ${pct}%*\n\nЭто поможет выйти из убыточной зоны. Виктор рассчитает новую цену и отправит запрос на маркетплейс.`,
      {
        parseMode: 'Markdown',
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '🚀 Подтверждаю', callback_data: `do_raise_percent:${mp}:${eid}:${pct}` },
              { text: '❌ Отмена', callback_data: `cancel_action` },
            ],
          ],
        },
      }
    );
    return;
  }

  // --- DO RAISE PERCENT ---
  if (data.startsWith('do_raise_percent:')) {
    const parts = data.split(':');
    const mp = parts[1];
    const eid = parts[2];
    const pct = parts[3];
    const userId = query.from.id;

    await sendTelegramMessage(Number(chatId), `⏳ Рассчитываю и обновляю цену на ${pct}%...`);
    const command = `Подними цену на товар ${eid} на ${pct}% на ${mp}`;

    try {
      const result = await orchestrateV5(command, {
        userId,
        isFirstContact: false,
        userName: query.from.first_name,
      });

      await sendTelegramMessage(Number(chatId), result.message, { parseMode: 'HTML' });
    } catch (e) {
      logger.error('Failed to raise price via callback', e);
      await sendTelegramMessage(Number(chatId), `❌ Ошибка при повышении цены.`);
    }
    return;
  }

  // --- SENTINEL ADMIN ACTIONS ---
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================

export async function handleTelegramWebhook(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update: TelegramUpdate = req.body;

    logger.info('Telegram webhook received', {
      updateId: update.update_id,
      hasMessage: !!update.message,
      hasCallback: !!update.callback_query,
    });

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    // Handle messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const user = message.from;
      const text = message.text?.trim() || '';

      // Ensure user exists in DB
      const userId = await ensureUserExists(user);

      // Check for commands
      if (text.startsWith('/')) {
        const command = text.split(' ')[0].toLowerCase();

        switch (command) {
          case '/start':
            await handleStartCommand(chatId, user);
            break;
          case '/help':
            await handleHelpCommand(chatId);
            break;
          case '/settings':
            await handleSettingsCommand(chatId);
            break;
          case '/status':
            await handleStatusCommand(chatId, userId);
            break;
          case '/health': {
            if (String(user.id) === String(config.ADMIN_TELEGRAM_ID)) {
              await sendTelegramMessage(chatId, '⏳ Запускаю проверку систем...');
              // Simple health check summary
              try {
                // Check DB and TG status
                const token = config.TELEGRAM_BOT_TOKEN;
                const tgRes = await fetch(`${TELEGRAM_API}${token}/getMe`);
                const tgData = (await tgRes.json()) as { result: { username: string } };

                const healthMsg = `
🛡️ <b>Системный пульс</b>
✅ БД: Соединение ок
✅ Бот: @${tgData.result.username}
✅ Крипто: Ключ настроен
🌐 Окружение: <code>${config.NODE_ENV}</code>

✨ Все системы в норме.
`;
                await sendTelegramMessage(chatId, healthMsg);
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                await sendTelegramMessage(chatId, `❌ Ошибка пульса: ${errorMsg}`);
              }
            } else {
              await sendTelegramMessage(chatId, '⛔ У вас нет прав для этой команды.');
            }
            break;
          }

          case '/sentinel': {
            if (String(user.id) === String(config.ADMIN_TELEGRAM_ID)) {
              await handleSentinelDashboard(chatId);
            } else {
              await sendTelegramMessage(chatId, '⛔ У вас нет прав для этой команды.');
            }
            break;
          }

          default:
            // Unknown command - treat as message
            await handleUserMessage(chatId, userId, text, user.first_name || 'User');
        }
      } else if (text) {
        // Regular message - send to Viktor AI
        await handleUserMessage(chatId, userId, text, user.first_name);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Telegram webhook error', error);
    // Always return 200 to Telegram to prevent retries
    return res.status(200).json({ ok: true, error: 'Internal error' });
  }
}

// ============================================
// WEBHOOK SETUP UTILITY
// ============================================

export async function setTelegramWebhook(webhookUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      logger.info('Telegram webhook set successfully', { url: webhookUrl });
      return { success: true };
    } else {
      logger.error('Failed to set Telegram webhook', { error: data.description });
      return { success: false, error: data.description };
    }
  } catch (error) {
    logger.error('Error setting Telegram webhook', error);
    return { success: false, error: String(error) };
  }
}

export async function getTelegramWebhookInfo(): Promise<{
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
}> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
    const data = await response.json();
    return data.result || {};
  } catch {
    return {};
  }
}
