"use strict";
// ============================================
// NeuroGUARDIAN — Alerting Module
// Telegram Bot notifications
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramAlert = sendTelegramAlert;
exports.sendDailySummary = sendDailySummary;
const axios_1 = __importDefault(require("axios"));
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
/**
 * Send Telegram notification to user
 */
async function sendTelegramAlert(telegramId, payload) {
    if (!BOT_TOKEN) {
        console.warn('TELEGRAM_BOT_TOKEN not set, skipping alert');
        return false;
    }
    try {
        const message = formatAlertMessage(payload);
        await axios_1.default.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: telegramId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        });
        console.log(`Sent alert to user ${telegramId}: ${payload.type}`);
        return true;
    }
    catch (error) {
        console.error(`Failed to send Telegram alert to ${telegramId}:`, error.message);
        // Check if user blocked the bot
        if (error.response?.data?.error_code === 403) {
            console.log(`User ${telegramId} has blocked the bot`);
        }
        return false;
    }
}
/**
 * Format alert message based on type
 */
function formatAlertMessage(payload) {
    switch (payload.type) {
        case 'defense_triggered':
            return formatDefenseAlert(payload);
        case 'sync_complete':
            return formatSyncAlert(payload);
        case 'error':
            return formatErrorAlert(payload);
        default:
            return '⚙️ NeuroGUARDIAN: Системное уведомление';
    }
}
function formatDefenseAlert(alert) {
    const emoji = alert.action === 'zero_stock' ? '🛡️' : '💰';
    const actionText = alert.action === 'zero_stock'
        ? 'Сток обнулён'
        : `Цена восстановлена до ${alert.minPrice.toLocaleString('ru-RU')}₽`;
    return `
${emoji} <b>ТРЕВОГА! ЗАЩИТА СРАБОТАЛА</b>

📦 <b>${escapeHtml(alert.productTitle)}</b>
🏷️ Артикул: <code>${alert.vendorCode}</code>
🏪 Маркетплейс: ${alert.marketplace}

📉 Цена упала до: <b>${alert.oldPrice.toLocaleString('ru-RU')}₽</b>
🎯 Ваш Stop-Loss: <b>${alert.minPrice.toLocaleString('ru-RU')}₽</b>

✅ <b>${actionText}</b>
💵 Сохранено: <b>${alert.savedAmount.toLocaleString('ru-RU')}₽</b>

Ваши деньги защищены! 💪
`.trim();
}
function formatSyncAlert(alert) {
    return `
🔄 <b>Синхронизация завершена</b>

🏪 Маркетплейс: ${alert.marketplace}
📦 Всего товаров: ${alert.productsCount}
🆕 Новых товаров: ${alert.newProducts}
`.trim();
}
function formatErrorAlert(alert) {
    return `
⚠️ <b>Ошибка NeuroGUARDIAN</b>

${escapeHtml(alert.message)}

${alert.context ? `Контекст: ${escapeHtml(alert.context)}` : ''}

Обратитесь в поддержку, если проблема повторяется.
`.trim();
}
/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/**
 * Send daily summary
 */
async function sendDailySummary(telegramId, stats) {
    if (!BOT_TOKEN)
        return false;
    const message = `
📊 <b>Ежедневный отчёт NeuroGUARDIAN</b>

📦 Товаров под защитой: <b>${stats.protectedProducts}</b> из ${stats.totalProducts}
🛡️ Защит сегодня: <b>${stats.triggeredToday}</b>
💰 Сохранено сегодня: <b>${stats.savedToday.toLocaleString('ru-RU')}₽</b>
📈 Сохранено всего: <b>${stats.totalSaved.toLocaleString('ru-RU')}₽</b>

${stats.triggeredToday > 0
        ? '✅ Ваши товары надёжно защищены!'
        : '😊 Сегодня атак не было. Всё спокойно!'}
`.trim();
    try {
        await axios_1.default.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: telegramId,
            text: message,
            parse_mode: 'HTML',
        });
        return true;
    }
    catch (error) {
        console.error(`Failed to send daily summary to ${telegramId}:`, error);
        return false;
    }
}
//# sourceMappingURL=alerting.js.map