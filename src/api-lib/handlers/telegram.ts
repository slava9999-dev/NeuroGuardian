// ============================================
// NeuroGUARDIAN — Telegram Bot Webhook Handler
// Receives messages from Telegram and routes to Viktor AI Agent
// Version: 1.0.0 | Date: January 2026
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { orchestrateV4 } from '../agent/orchestrator-v4.js';
import { logger } from '../lib/index.js';

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

// ============================================
// TELEGRAM API HELPERS
// ============================================

const TELEGRAM_API = 'https://api.telegram.org/bot';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }
  return token;
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

async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
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

    logger.info('New user created from Telegram', { 
      userId: telegramUser.id, 
      username: telegramUser.username 
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

async function handleStartCommand(
  chatId: number,
  user: TelegramUser
): Promise<void> {
  await ensureUserExists(user);

  const webAppUrl = process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app';

  const welcomeMessage = `
👋 <b>Привет, ${user.first_name}!</b>

Я <b>Viktor</b> — ваш AI-помощник для управления магазином на Wildberries и Ozon.

🎯 <b>Что я умею:</b>
• 📊 Показывать статистику продаж
• 🛡️ Защищать маржу от принудительных акций
• 💰 Управлять ценами автоматически
• 📈 Анализировать тренды и конкурентов

🎁 <b>У вас 7 дней бесплатного доступа!</b>

Напишите мне что-нибудь или нажмите кнопку ниже, чтобы открыть полное приложение.
`;

  await sendTelegramMessage(chatId, welcomeMessage, {
    parseMode: 'HTML',
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '🚀 Открыть приложение',
            web_app: { url: webAppUrl },
          },
        ],
        [
          {
            text: '❓ Помощь',
            callback_data: 'help',
          },
          {
            text: '⚙️ Настройки',
            callback_data: 'settings',
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

  await sendTelegramMessage(
    chatId,
    '⚙️ Для настройки API ключей откройте приложение:',
    {
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
    }
  );
}

async function handleStatusCommand(
  chatId: number,
  userId: number
): Promise<void> {
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

// ============================================
// MESSAGE HANDLER (VIKTOR AI)
// ============================================

async function handleUserMessage(
  chatId: number,
  userId: number,
  text: string
): Promise<void> {
  // Show typing indicator
  await sendTypingAction(chatId);

  try {
    // Call Viktor AI Agent
    const result = await orchestrateV4(text, {
      userId,
      marketplace: 'all',
    });

    if (result.success) {
      // Format response for Telegram
      let response = result.message;

      // Add links if present
      if (result.links && result.links.length > 0) {
        response += '\n\n🔗 <b>Ссылки:</b>\n';
        result.links.forEach((link) => {
          response += `• <a href="${link.url}">${link.title}</a>\n`;
        });
      }

      // Add actions if present
      if (result.actions && result.actions.length > 0) {
        response += '\n\n⚡ <b>Выполненные действия:</b>\n';
        result.actions.forEach((action) => {
          response += `• ${action.summary}\n`;
        });
      }

      await sendTelegramMessage(chatId, response, { parseMode: 'HTML' });
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

      await sendTelegramMessage(chatId, 
        `⚠️ *Подтвердите изменение цены*\n\n` +
        `📦 Артикул: \`${externalId}\`\n` +
        `💰 Новая цена: *${price}₽*\n\n` +
        `Вы уверены?`,
        {
          parseMode: 'Markdown',
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Да, применить', callback_data: `apply_price:${marketplace}:${externalId}:${price}` },
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
        const result = await orchestrateV4(command, { userId, marketplace: 'all' });
        
        if (result.success) {
           await sendTelegramMessage(chatId, 
             `✅ *Цена обновлена!*\n\n` +
             `📦 Артикул: \`${externalId}\`\n` +
             `💰 Новая цена: *${price}₽*\n\n` +
             `${result.message}`, 
             { parseMode: 'Markdown' }
           );
        } else {
           await sendTelegramMessage(chatId, 
             `❌ *Ошибка обновления цены*\n\n${result.message}`, 
             { parseMode: 'Markdown' }
           );
        }
      } catch (e) {
         logger.error('Failed to apply price via callback', e);
         await sendTelegramMessage(chatId, `❌ Системная ошибка при обновлении цены. Попробуйте позже.`);
      }
    }
    return;
  }

  // --- IGNORE ALERT ---
  if (data.startsWith('ignore_alert:')) {
    const externalId = data.split(':')[1];
    await sendTelegramMessage(chatId, 
      `👌 Уведомление проигнорировано.\n\n` +
      `Товар \`${externalId}\` останется с текущей ценой.\n` +
      `Sentinel продолжит мониторинг.`,
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
    
    await sendTelegramMessage(chatId, 
      `🛡️ *Настройка защиты*\n\n` +
      `Откройте приложение для настройки правил защиты товара \`${externalId}\`.`,
      {
        parseMode: 'Markdown',
        replyMarkup: {
          inline_keyboard: [[
            { text: '⚙️ Открыть настройки', web_app: { url: `${process.env.WEBAPP_URL || 'https://neuro-guardian.vercel.app'}?page=products` } },
          ]],
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
       await sendTelegramMessage(chatId, '💳 Оплата подписки скоро будет доступна. Сейчас у вас действует пробный период.');
       break;
    default:
      // Unknown callback
      break;
  }
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
          default:
            // Unknown command - treat as message
            await handleUserMessage(chatId, userId, text);
        }
      } else if (text) {
        // Regular message - send to Viktor AI
        await handleUserMessage(chatId, userId, text);
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
    const response = await fetch(
      `${TELEGRAM_API}${token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true,
        }),
      }
    );

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
