import { sentinelTelegram } from '../src/sentinel/SentinelTelegram.js';
import type { CompetitorAlert } from '../src/sentinel/SentinelAgent.js';
import { config } from '../src/infrastructure/config/env.js';

async function testTelegramAlert() {
  console.log('🛡️ Testing Sentinel Telegram Integration\n');

  // Mock alert data
  const mockAlert: CompetitorAlert = {
    productId: 123,
    productName: 'iPhone 15 Pro 256GB Titanium',
    yourPrice: 89990,
    competitorPrice: 76490,
    competitorUrl: 'https://www.wildberries.ru/catalog/153373282/detail.aspx',
    priceDropPercent: 15,
    marketplace: 'WB',
    recommendedAction: 'lower_price',
    recommendedPrice: 75990,
  };

  const chatId = parseInt(config.ADMIN_TELEGRAM_ID || '0');

  if (!chatId) {
    console.error('❌ ADMIN_TELEGRAM_ID not configured in .env');
    return;
  }

  console.log(`📱 Sending alert to Telegram chat: ${chatId}\n`);

  try {
    await sentinelTelegram.sendAlert(chatId, mockAlert);
    console.log('✅ Alert sent successfully!');
    console.log('\n📲 Check your Telegram for the message');
  } catch (error) {
    console.error('❌ Failed to send alert:', error);
  }
}

testTelegramAlert().catch(console.error);
