#!/usr/bin/env npx tsx
/**
 * 🔬 КРИТИЧЕСКИЙ АУДИТ АГЕНТА ВИКТОРА
 * Проверяем ВСЕ: от архитектуры до мелких багов
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  🔬 КРИТИЧЕСКИЙ АУДИТ ВИКТОР ИИ');
console.log('  Дата:', new Date().toLocaleString('ru-RU'));
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

interface AuditResult {
  category: string;
  item: string;
  status: 'OK' | 'WARN' | 'FAIL' | 'INFO';
  message: string;
}

const results: AuditResult[] = [];

function log(
  category: string,
  item: string,
  status: 'OK' | 'WARN' | 'FAIL' | 'INFO',
  message: string
) {
  results.push({ category, item, status, message });
  const emoji = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : status === 'FAIL' ? '❌' : 'ℹ️';
  console.log(`  ${emoji} [${category}] ${item}: ${message}`);
}

// ============================================
// 1. ПРОВЕРКА ОКРУЖЕНИЯ
// ============================================
console.log('\n📋 1. ПРОВЕРКА ОКРУЖЕНИЯ');
console.log('─────────────────────────────────────────────────────────────────');

// Загружаем .env.local
const envPath = '.env.local';
const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

const criticalEnvVars = [
  'DATABASE_URL',
  'GROQ_API_KEY',
  'SERPER_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'ADMIN_API_KEY',
  'CRON_SECRET',
];

for (const key of criticalEnvVars) {
  const exists =
    envContent.includes(key + '=') &&
    !envContent.includes(key + '=\n') &&
    !envContent.includes(key + '=\r');
  const hasValue = envContent.match(new RegExp(`${key}=.+`));

  if (hasValue) {
    log('ENV', key, 'OK', 'Настроен');
  } else if (exists) {
    log('ENV', key, 'WARN', 'Пустое значение!');
  } else {
    log('ENV', key, 'FAIL', 'Отсутствует!');
  }
}

// ============================================
// 2. ПРОВЕРКА КРИТИЧЕСКИХ ФАЙЛОВ
// ============================================
console.log('\n📋 2. ПРОВЕРКА КРИТИЧЕСКИХ ФАЙЛОВ');
console.log('─────────────────────────────────────────────────────────────────');

const criticalFiles = [
  'src/api-lib/agent/orchestrator-v4.ts',
  'src/api-lib/agent/prompts/system-v5.ts',
  'src/api-lib/agent/tool-executors.ts',
  'src/api-lib/services/sentinel-service.ts',
  'src/api-lib/services/notifications.ts',
  'src/api-lib/services/competitor-monitor.ts',
  'src/api-lib/handlers/agent-v4.ts',
  'src/api-lib/handlers/sentinel.ts',
];

for (const file of criticalFiles) {
  if (existsSync(file)) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    log('FILES', file.split('/').pop()!, 'OK', `${lines} строк`);
  } else {
    log('FILES', file, 'FAIL', 'Файл не найден!');
  }
}

// ============================================
// 3. ПРОВЕРКА ИМПОРТОВ И ЗАВИСИМОСТЕЙ
// ============================================
console.log('\n📋 3. ПРОВЕРКА ИМПОРТОВ');
console.log('─────────────────────────────────────────────────────────────────');

// Проверяем что orchestrator использует v5 промпты
const orchestratorContent = readFileSync('src/api-lib/agent/orchestrator-v4.ts', 'utf-8');
if (orchestratorContent.includes('system-v5')) {
  log('IMPORTS', 'Prompts V5', 'OK', 'Orchestrator использует system-v5.ts');
} else if (orchestratorContent.includes('system-v4')) {
  log('IMPORTS', 'Prompts V5', 'WARN', 'Orchestrator ещё на V4!');
} else {
  log('IMPORTS', 'Prompts V5', 'FAIL', 'Промпты не найдены');
}

// ============================================
// 4. ПРОВЕРКА ИНСТРУМЕНТОВ АГЕНТА
// ============================================
console.log('\n📋 4. ПРОВЕРКА ИНСТРУМЕНТОВ');
console.log('─────────────────────────────────────────────────────────────────');

const toolExecutorsContent = readFileSync('src/api-lib/agent/tool-executors.ts', 'utf-8');

const expectedTools = [
  'executeGetProducts',
  'executeGetSalesStats',
  'executeGetOrders',
  'executeCalculateUnitEconomics',
  'executeGetAbcAnalysis',
  'executeGetWarehouseStocks',
  'executeGetStockForecast',
  'executeSearchWeb',
  'executeGetCompetitorPrice',
  'executeUpdatePrices',
  'executeSetStopLoss',
  'executeGetReviews',
];

for (const tool of expectedTools) {
  if (toolExecutorsContent.includes(`export async function ${tool}`)) {
    log('TOOLS', tool, 'OK', 'Реализован');
  } else {
    log('TOOLS', tool, 'FAIL', 'Не найден!');
  }
}

// ============================================
// 5. ПРОВЕРКА ЛОГИКИ FALLBACK
// ============================================
console.log('\n📋 5. ПРОВЕРКА FALLBACK ЛОГИКИ');
console.log('─────────────────────────────────────────────────────────────────');

// Web search fallback в get_competitor_price
if (toolExecutorsContent.includes('web_search') && toolExecutorsContent.includes('serperKey')) {
  log('FALLBACK', 'CompetitorPrice→Search', 'OK', 'Fallback на web search реализован');
} else {
  log('FALLBACK', 'CompetitorPrice→Search', 'WARN', 'Fallback не найден');
}

// Error handling
const hasErrorHandling = toolExecutorsContent.match(/catch\s*\(/g)?.length || 0;
log(
  'FALLBACK',
  'Error Handlers',
  hasErrorHandling > 10 ? 'OK' : 'WARN',
  `${hasErrorHandling} try-catch блоков`
);

// ============================================
// 6. ПРОВЕРКА УВЕДОМЛЕНИЙ
// ============================================
console.log('\n📋 6. ПРОВЕРКА УВЕДОМЛЕНИЙ');
console.log('─────────────────────────────────────────────────────────────────');

const notificationsContent = readFileSync('src/api-lib/services/notifications.ts', 'utf-8');

// Проверка на технические термины
const techTerms = ['SENTINEL', 'API токен', 'Unit-economics', 'margin', 'webhook'];
for (const term of techTerms) {
  const count = (notificationsContent.match(new RegExp(term, 'gi')) || []).length;
  if (count > 3) {
    log('NOTIFICATIONS', `Термин "${term}"`, 'WARN', `${count} упоминаний — слишком технично?`);
  } else {
    log('NOTIFICATIONS', `Термин "${term}"`, 'OK', `${count} упоминаний`);
  }
}

// Проверка на "Виктор ИИ"
const viktorMentions = (notificationsContent.match(/Виктор ИИ/g) || []).length;
log(
  'NOTIFICATIONS',
  'Брендинг "Виктор ИИ"',
  viktorMentions >= 3 ? 'OK' : 'WARN',
  `${viktorMentions} упоминаний`
);

// ============================================
// 7. ПРОВЕРКА ПРОМПТОВ
// ============================================
console.log('\n📋 7. ПРОВЕРКА ПРОМПТОВ V5');
console.log('─────────────────────────────────────────────────────────────────');

const promptsV5Content = readFileSync('src/api-lib/agent/prompts/system-v5.ts', 'utf-8');

// Проверка на ключевые элементы
const promptChecks = [
  { name: 'Имя Виктор', pattern: /Виктор/g, min: 5 },
  { name: 'Упоминание маржи', pattern: /прибыл|маржа|margn/gi, min: 1 },
  { name: 'Упоминание WB', pattern: /Wildberries|WB/gi, min: 3 },
  { name: 'Упоминание Ozon', pattern: /Ozon|Озон/gi, min: 2 },
  { name: 'Инструкции по ценам', pattern: /цен|price/gi, min: 5 },
  {
    name: 'Запрет на галлюцинации',
    pattern: /не придумывай|не генерир|only.*url|ТОЛЬКО/gi,
    min: 1,
  },
];

for (const check of promptChecks) {
  const matches = (promptsV5Content.match(check.pattern) || []).length;
  if (matches >= check.min) {
    log('PROMPTS', check.name, 'OK', `${matches} упоминаний`);
  } else {
    log('PROMPTS', check.name, 'WARN', `Только ${matches} (нужно ≥${check.min})`);
  }
}

// ============================================
// 8. ПРОВЕРКА SENTINEL
// ============================================
console.log('\n📋 8. ПРОВЕРКА SENTINEL SERVICE');
console.log('─────────────────────────────────────────────────────────────────');

const sentinelContent = readFileSync('src/api-lib/services/sentinel-service.ts', 'utf-8');

// Ключевые функции
const sentinelFunctions = ['runCycle', 'processUser', 'handleMarketplaceThreats', 'executeDefense'];
for (const fn of sentinelFunctions) {
  if (sentinelContent.includes(fn)) {
    log('SENTINEL', fn, 'OK', 'Реализован');
  } else {
    log('SENTINEL', fn, 'FAIL', 'Не найден!');
  }
}

// Проверка на защитные механизмы
if (sentinelContent.includes('min_price') && sentinelContent.includes('stop_loss')) {
  log('SENTINEL', 'Stop-Loss Logic', 'OK', 'min_price и stop_loss обработка есть');
} else {
  log('SENTINEL', 'Stop-Loss Logic', 'WARN', 'Проверь логику защиты');
}

// ============================================
// 9. ПРОВЕРКА БЕЗОПАСНОСТИ
// ============================================
console.log('\n📋 9. ПРОВЕРКА БЕЗОПАСНОСТИ');
console.log('─────────────────────────────────────────────────────────────────');

// Проверяем что API keys не хардкодятся
const allContent = toolExecutorsContent + orchestratorContent + notificationsContent;
const hardcodedKeys = allContent.match(/['"][a-zA-Z0-9]{20,}['"]/g) || [];
if (hardcodedKeys.length > 5) {
  log(
    'SECURITY',
    'Hardcoded Keys',
    'WARN',
    `Найдено ${hardcodedKeys.length} длинных строк — проверь!`
  );
} else {
  log('SECURITY', 'Hardcoded Keys', 'OK', 'Ключи не захардкожены');
}

// Проверяем getSecret использование
const secretUsage = (allContent.match(/getSecret/g) || []).length;
log(
  'SECURITY',
  'getSecret Usage',
  secretUsage > 3 ? 'OK' : 'INFO',
  `${secretUsage} вызовов getSecret`
);

// ============================================
// 10. ИТОГОВЫЙ ОТЧЁТ
// ============================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  📊 ИТОГОВЫЙ ОТЧЁТ');
console.log('═══════════════════════════════════════════════════════════════');

const okCount = results.filter(r => r.status === 'OK').length;
const warnCount = results.filter(r => r.status === 'WARN').length;
const failCount = results.filter(r => r.status === 'FAIL').length;

console.log(`  ✅ OK:   ${okCount}`);
console.log(`  ⚠️ WARN: ${warnCount}`);
console.log(`  ❌ FAIL: ${failCount}`);
console.log('');

if (failCount > 0) {
  console.log('❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ:');
  results
    .filter(r => r.status === 'FAIL')
    .forEach(r => {
      console.log(`   • [${r.category}] ${r.item}: ${r.message}`);
    });
  console.log('');
}

if (warnCount > 0) {
  console.log('⚠️ ТРЕБУЮТ ВНИМАНИЯ:');
  results
    .filter(r => r.status === 'WARN')
    .forEach(r => {
      console.log(`   • [${r.category}] ${r.item}: ${r.message}`);
    });
  console.log('');
}

const score = Math.round((okCount / (okCount + warnCount + failCount)) * 100);
console.log(`📈 ОЦЕНКА ЗДОРОВЬЯ: ${score}%`);
console.log('═══════════════════════════════════════════════════════════════');

process.exit(failCount > 0 ? 1 : 0);
