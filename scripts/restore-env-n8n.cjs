#!/usr/bin/env node
/**
 * Восстановление .env.n8n из .env
 * Копирует нужные переменные для n8n
 */

const fs = require('fs');
const path = require('path');

// Переменные, которые нужны для n8n
const N8N_REQUIRED_VARS = [
  'API_URL',
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_CHAT_ID',
  'ADMIN_TELEGRAM_ID',
  'ADMIN_API_KEY',
  'OPENAI_API_KEY',
  'SERPER_API_KEY'
];

// Дефолтные значения для n8n-специфичных переменных
const N8N_DEFAULTS = {
  'N8N_HOST': 'localhost',
  'N8N_PORT': '5678',
  'N8N_WEBHOOK_URL': 'http://localhost:5678/',
  'N8N_BASIC_AUTH_USER': 'admin',
  'N8N_BASIC_AUTH_PASSWORD': 'CHANGE_THIS_STRONG_PASSWORD',
  'N8N_API_KEY': 'YOUR_N8N_API_KEY_HERE'
};

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   Восстановление .env.n8n из .env              ║');
  console.log('║   NeuroGUARDIAN                                 ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Читаем .env
  console.log('📖 Читаем .env...');
  const mainEnv = parseEnvFile('.env');
  
  if (Object.keys(mainEnv).length === 0) {
    console.error('❌ Файл .env пуст или не найден!');
    process.exit(1);
  }
  
  console.log(`   ✅ Найдено ${Object.keys(mainEnv).length} переменных\n`);

  // Создаем .env.n8n
  console.log('🔧 Создаем .env.n8n...\n');
  
  let content = '# n8n Environment Variables for NeuroGUARDIAN\n';
  content += '# Автоматически восстановлено из .env\n';
  content += `# ${new Date().toISOString()}\n\n`;

  // NeuroGUARDIAN API
  content += '# NeuroGUARDIAN API\n';
  const apiVars = ['API_URL', 'CRON_SECRET'];
  apiVars.forEach(key => {
    if (mainEnv[key]) {
      content += `${key}=${mainEnv[key]}\n`;
      console.log(`   ✅ ${key}`);
    } else {
      console.log(`   ⚠️  ${key} - не найден в .env`);
    }
  });
  content += '\n';

  // Telegram Bot
  content += '# Telegram Bot\n';
  const telegramVars = ['TELEGRAM_BOT_TOKEN', 'ADMIN_CHAT_ID', 'ADMIN_TELEGRAM_ID'];
  telegramVars.forEach(key => {
    if (mainEnv[key]) {
      content += `${key}=${mainEnv[key]}\n`;
      console.log(`   ✅ ${key}`);
    } else {
      console.log(`   ⚠️  ${key} - не найден в .env`);
    }
  });
  content += '\n';

  // n8n Settings
  content += '# n8n Settings (для скриптов импорта)\n';
  Object.entries(N8N_DEFAULTS).forEach(([key, value]) => {
    if (key.startsWith('N8N_') && !key.includes('AUTH') && !key.includes('WEBHOOK')) {
      content += `${key}=${value}\n`;
      console.log(`   📝 ${key} (default)`);
    }
  });
  content += '\n';

  // n8n Authentication
  content += '# n8n Authentication (ОБЯЗАТЕЛЬНО сменить!)\n';
  ['N8N_BASIC_AUTH_USER', 'N8N_BASIC_AUTH_PASSWORD'].forEach(key => {
    content += `${key}=${N8N_DEFAULTS[key]}\n`;
    console.log(`   📝 ${key} (default - ИЗМЕНИТЕ!)`);
  });
  content += '\n';

  // n8n Webhook URL
  content += '# n8n Webhook URL (для production - указать реальный URL)\n';
  content += `N8N_WEBHOOK_URL=${N8N_DEFAULTS['N8N_WEBHOOK_URL']}\n\n`;
  console.log(`   📝 N8N_WEBHOOK_URL (default)`);

  // Optional
  content += '# Optional\n';
  const optionalVars = ['ADMIN_API_KEY', 'OPENAI_API_KEY', 'SERPER_API_KEY'];
  optionalVars.forEach(key => {
    if (mainEnv[key]) {
      content += `${key}=${mainEnv[key]}\n`;
      console.log(`   ✅ ${key}`);
    }
  });
  content += '\n';

  // Записываем файл
  fs.writeFileSync('.env.n8n', content, 'utf-8');
  
  console.log('\n✅ Файл .env.n8n восстановлен!\n');
  
  console.log('⚠️  ВАЖНО:');
  console.log('   1. Измените N8N_BASIC_AUTH_PASSWORD на сильный пароль');
  console.log('   2. Получите N8N_API_KEY из n8n (Settings → API → Create API Key)');
  console.log('   3. Добавьте его в .env.n8n\n');
  
  console.log('🚀 Следующий шаг:');
  console.log('   docker-compose -f docker-compose.n8n.yml --env-file .env.n8n up -d\n');
}

main();
