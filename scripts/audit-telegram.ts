#!/usr/bin/env npx tsx
/**
 * 🔍 ПОЛНЫЙ АУДИТ TELEGRAM ИНТЕГРАЦИИ
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  📱 АУДИТ TELEGRAM ИНТЕГРАЦИИ');
console.log('  Время:', new Date().toLocaleString('ru-RU'));
console.log('═══════════════════════════════════════════════════════════════');

// Load .env.local
const envPath = '.env.local';
const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

// ============================================
// 1. ПРОВЕРКА КЛЮЧЕЙ
// ============================================
console.log('\n📋 1. TELEGRAM КЛЮЧИ');
console.log('─────────────────────────────────────────────────────────────────');

const tgKeys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_CHAT_ID', 'TELEGRAM_WEBHOOK_SECRET'];

for (const key of tgKeys) {
  const match = envContent.match(new RegExp(`${key}=(.+)`));
  if (match && match[1].trim()) {
    const val = match[1].trim();
    console.log(`  ✅ ${key}: ${val.substring(0, 15)}...`);
  } else {
    console.log(`  ❌ ${key}: НЕ НАЙДЕН`);
  }
}

// ============================================
// 2. ПРОВЕРКА BOT TOKEN
// ============================================
console.log('\n📋 2. ПРОВЕРКА BOT TOKEN');
console.log('─────────────────────────────────────────────────────────────────');

const botToken = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/)?.[1]?.trim();

if (botToken) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = (await response.json()) as {
      ok: boolean;
      result?: { username: string; first_name: string };
    };

    if (data.ok) {
      console.log(`  ✅ Бот активен!`);
      console.log(`     Username: @${data.result?.username}`);
      console.log(`     Name: ${data.result?.first_name}`);
    } else {
      console.log(`  ❌ Бот неактивен: ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`  ❌ Ошибка подключения: ${e}`);
  }
} else {
  console.log('  ⚠️ TELEGRAM_BOT_TOKEN не найден в .env.local');
}

// ============================================
// 3. ПРОВЕРКА WEBHOOK
// ============================================
console.log('\n📋 3. WEBHOOK НАСТРОЙКА');
console.log('─────────────────────────────────────────────────────────────────');

if (botToken) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = (await response.json()) as {
      ok: boolean;
      result?: {
        url: string;
        pending_update_count: number;
        last_error_message?: string;
        last_error_date?: number;
      };
    };

    if (data.ok && data.result) {
      if (data.result.url) {
        console.log(`  ✅ Webhook установлен: ${data.result.url}`);
        console.log(`     Pending updates: ${data.result.pending_update_count}`);
        if (data.result.last_error_message) {
          console.log(`  ⚠️ Последняя ошибка: ${data.result.last_error_message}`);
        }
      } else {
        console.log(`  ⚠️ Webhook НЕ установлен`);
        console.log(`     Бот работает в polling режиме или не настроен`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Ошибка: ${e}`);
  }
}

// ============================================
// 4. ПРОВЕРКА КОДА
// ============================================
console.log('\n📋 4. ПРОВЕРКА КОДА');
console.log('─────────────────────────────────────────────────────────────────');

const files = [
  { path: 'src/api-lib/services/notifications.ts', name: 'Notifications Service' },
  { path: 'src/api-lib/handlers/telegram-webhook.ts', name: 'Telegram Webhook Handler' },
  { path: 'src/api-lib/handlers/telegram-bot.ts', name: 'Telegram Bot Handler' },
];

for (const file of files) {
  if (existsSync(file.path)) {
    const content = readFileSync(file.path, 'utf-8');
    const lines = content.split('\n').length;
    console.log(`  ✅ ${file.name}: ${lines} строк`);

    // Check key functions
    if (file.path.includes('notifications')) {
      const hasSendAlert = content.includes('sendAlert');
      const hasSendTelegram = content.includes('sendTelegram') || content.includes('TELEGRAM');
      console.log(`     sendAlert: ${hasSendAlert ? '✅' : '❌'}`);
      console.log(`     Telegram: ${hasSendTelegram ? '✅' : '❌'}`);
    }
  } else {
    console.log(`  ⚠️ ${file.name}: Файл не найден`);
  }
}

// ============================================
// 5. ПРОВЕРКА ФОРМАТИРОВАНИЯ СООБЩЕНИЙ
// ============================================
console.log('\n📋 5. ФОРМАТИРОВАНИЕ СООБЩЕНИЙ');
console.log('─────────────────────────────────────────────────────────────────');

if (existsSync('src/api-lib/services/notifications.ts')) {
  const content = readFileSync('src/api-lib/services/notifications.ts', 'utf-8');

  // Check for Viktor AI branding
  const viktorMentions = (content.match(/Виктор ИИ/g) || []).length;
  const sentinelMentions = (content.match(/SENTINEL/gi) || []).length;

  console.log(`  Виктор ИИ упоминаний: ${viktorMentions}`);
  console.log(
    `  SENTINEL упоминаний: ${sentinelMentions} ${sentinelMentions > 0 ? '⚠️ (нужна замена)' : '✅'}`
  );

  // Check for price_protection alert
  if (content.includes("type: 'price_protection'")) {
    console.log(`  ✅ price_protection alert: присутствует`);
  }

  // Check for sentinel_alert
  if (content.includes("type: 'sentinel_alert'")) {
    console.log(`  ✅ sentinel_alert: присутствует`);
  }
}

// ============================================
// 6. ТЕСТ ОТПРАВКИ (если есть admin chat)
// ============================================
console.log('\n📋 6. ТЕСТ ОТПРАВКИ');
console.log('─────────────────────────────────────────────────────────────────');

const adminChatId = envContent.match(/TELEGRAM_ADMIN_CHAT_ID=(.+)/)?.[1]?.trim();

if (botToken && adminChatId) {
  console.log(`  Admin Chat ID: ${adminChatId}`);
  console.log(`  🔄 Отправляю тестовое сообщение...`);

  try {
    const testMessage = `🧪 *Тест Виктор ИИ*\n\nВремя: ${new Date().toLocaleString('ru-RU')}\n\nЭто тестовое сообщение для проверки интеграции.`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: testMessage,
        parse_mode: 'Markdown',
      }),
    });

    const data = (await response.json()) as { ok: boolean; description?: string };

    if (data.ok) {
      console.log(`  ✅ Сообщение отправлено успешно!`);
    } else {
      console.log(`  ❌ Ошибка отправки: ${data.description}`);
    }
  } catch (e) {
    console.log(`  ❌ Ошибка: ${e}`);
  }
} else {
  console.log(`  ⚠️ Не хватает BOT_TOKEN или ADMIN_CHAT_ID для теста`);
  console.log(`  Добавьте в .env.local:`);
  console.log(`  TELEGRAM_BOT_TOKEN=your_token`);
  console.log(`  TELEGRAM_ADMIN_CHAT_ID=your_chat_id`);
}

// ============================================
// ИТОГО
// ============================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  📊 ИТОГО');
console.log('═══════════════════════════════════════════════════════════════');

const hasToken = !!botToken;
const hasAdmin = !!adminChatId;

if (hasToken && hasAdmin) {
  console.log('  ✅ Telegram интеграция готова к работе!');
} else if (hasToken) {
  console.log('  ⚠️ Бот есть, но ADMIN_CHAT_ID не настроен (уведомления не будут приходить)');
} else {
  console.log('  ❌ Telegram не настроен для локальной разработки');
  console.log('  📝 Добавьте ключи в .env.local или проверьте Vercel');
}
