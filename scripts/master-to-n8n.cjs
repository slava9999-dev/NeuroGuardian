#!/usr/bin/env node
/**
 * Создаёт .env.n8n из .env.master
 * Выбирает только переменные нужные для n8n
 */

const fs = require('fs');

// Переменные нужные для n8n
const N8N_VARS = [
  'CRON_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_API_KEY',
  'ADMIN_CHAT_ID',
  'OPENAI_API_KEY',
  'SERPER_API_KEY',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];

console.log('\n╔════════════════════════════════════════════════╗');
console.log('║   .env.master → .env.n8n                       ║');
console.log('╚════════════════════════════════════════════════╝\n');

// Читаем .env.master
if (!fs.existsSync('.env.master')) {
  console.error('❌ Файл .env.master не найден!');
  process.exit(1);
}

const masterContent = fs.readFileSync('.env.master', 'utf-8');
const masterVars = {};

masterContent.split('\n').forEach(line => {
  if (line.startsWith('#') || !line.includes('=')) return;
  const [key, ...valueParts] = line.split('=');
  const value = valueParts.join('=').trim();
  if (key && value) {
    masterVars[key.trim()] = value;
  }
});

console.log(`📖 Прочитано ${Object.keys(masterVars).length} переменных из .env.master\n`);

// Создаём .env.n8n
let n8nContent = `# n8n Environment Variables for NeuroGUARDIAN
# Сгенерировано из .env.master: ${new Date().toISOString()}

# API
API_URL=https://neuro-guardian.vercel.app

`;

let added = 0;
let missing = [];

for (const key of N8N_VARS) {
  if (masterVars[key]) {
    n8nContent += `${key}=${masterVars[key]}\n`;
    console.log(`  ✅ ${key}`);
    added++;
  } else {
    console.log(`  ⚠️  ${key} (не найдена)`);
    missing.push(key);
  }
}

// Добавляем ADMIN_CHAT_ID
n8nContent += `\n# Admin\nADMIN_CHAT_ID=${masterVars['ADMIN_CHAT_ID'] || '7548070478'}\n`;

// Записываем
fs.writeFileSync('.env.n8n', n8nContent);

console.log(`\n✅ Записано в .env.n8n (${added} переменных)`);

if (missing.length > 0) {
  console.log(`\n⚠️  Отсутствуют: ${missing.join(', ')}`);
}

console.log('\n🚀 Запуск n8n:');
console.log('   docker-compose -f docker-compose.n8n.yml --env-file .env.n8n up -d\n');
