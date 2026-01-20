import { getTelegramWebhookInfo, setTelegramWebhook } from '../src/api-lib/handlers/telegram.js';
import { config } from '../src/infrastructure/config/env.js';

async function checkWebhook() {
  console.log('--- Checking Telegram Webhook ---');
  console.log('Bot Token present:', !!config.TELEGRAM_BOT_TOKEN);

  try {
    const info = await getTelegramWebhookInfo();
    console.log('Webhook Info:', JSON.stringify(info, null, 2));

    if (!info.url || info.url === '') {
      console.log('⚠️ Webhook URL is EMPTY!');
    } else {
      console.log(`✅ Current Webhook URL: ${info.url}`);
      if (info.pending_update_count && info.pending_update_count > 10) {
        console.log(
          `⚠️ Warning: ${info.pending_update_count} pending updates. Bot might be stuck.`
        );
      }
    }
  } catch (error) {
    console.error('❌ Failed to get webhook info:', error);
  }
}

checkWebhook().catch(console.error);
