#!/usr/bin/env npx tsx
/**
 * 🎯 АУДИТ ПРОАКТИВНОЙ ПОМОЩИ СЕЛЛЕРУ
 * Проверяем: уведомления, рекомендации, автоматика
 */

import { readFileSync, existsSync } from 'fs';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  🎯 ПРОАКТИВНАЯ ПОМОЩЬ СЕЛЛЕРУ');
console.log('  Viktor AI — Управляющий твоим магазином');
console.log('═══════════════════════════════════════════════════════════════');

interface Check {
  name: string;
  status: 'OK' | 'WARN' | 'FAIL';
  details: string;
}

const checks: Check[] = [];

function check(name: string, status: 'OK' | 'WARN' | 'FAIL', details: string) {
  checks.push({ name, status, details });
  const emoji = status === 'OK' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`  ${emoji} ${name}: ${details}`);
}

// ============================================
// 1. SENTINEL — АВТОМАТИЧЕСКАЯ ЗАЩИТА ЦЕН
// ============================================
console.log('\n📋 1. АВТОМАТИЧЕСКАЯ ЗАЩИТА ЦЕН (Sentinel)');
console.log('─────────────────────────────────────────────────────────────────');

const sentinelPath = 'src/api-lib/services/sentinel-service.ts';
if (existsSync(sentinelPath)) {
  const content = readFileSync(sentinelPath, 'utf-8');

  // Check for key proactive features
  const hasAutoDefense = content.includes('executeDefense');
  const hasNotifyThreat = content.includes('notifyThreat');
  const hasSmartRepricing =
    content.includes('smart_reprice') || content.includes('calculateOptimalPrice');

  check(
    'Автозащита Stop-Loss',
    hasAutoDefense ? 'OK' : 'FAIL',
    hasAutoDefense ? 'executeDefense реализован' : 'Не найден!'
  );

  check(
    'Уведомления об угрозах',
    hasNotifyThreat ? 'OK' : 'WARN',
    hasNotifyThreat ? 'notifyThreat работает' : 'Не найден'
  );

  check(
    'Умное репрайсинг',
    hasSmartRepricing ? 'OK' : 'WARN',
    hasSmartRepricing ? 'PriceShield интегрирован' : 'Не найден'
  );
}

// ============================================
// 2. УВЕДОМЛЕНИЯ — СВОЕВРЕМЕННОЕ ИНФОРМИРОВАНИЕ
// ============================================
console.log('\n📋 2. СИСТЕМА УВЕДОМЛЕНИЙ');
console.log('─────────────────────────────────────────────────────────────────');

const notifPath = 'src/api-lib/services/notifications.ts';
if (existsSync(notifPath)) {
  const content = readFileSync(notifPath, 'utf-8');

  const alertTypes = [
    'price_protection',
    'sentinel_alert',
    'margin_warning',
    'stock_warning',
    'competitor_alert',
  ];

  for (const type of alertTypes) {
    const found = content.includes(type);
    check(`Alert: ${type}`, found ? 'OK' : 'WARN', found ? 'Поддерживается' : 'Не найден');
  }

  // Check for LLM-generated messages
  const hasSmartMessage = content.includes('generateSmartMessage');
  check(
    'AI-генерация сообщений',
    hasSmartMessage ? 'OK' : 'WARN',
    hasSmartMessage ? 'generateSmartMessage есть' : 'Только шаблоны'
  );
}

// ============================================
// 3. РЕКОМЕНДАЦИИ В ОТВЕТАХ АГЕНТА
// ============================================
console.log('\n📋 3. РЕКОМЕНДАЦИИ АГЕНТА');
console.log('─────────────────────────────────────────────────────────────────');

const toolsPath = 'src/api-lib/agent/tool-executors.ts';
if (existsSync(toolsPath)) {
  const content = readFileSync(toolsPath, 'utf-8');

  const features = [
    { name: 'Рекомендации по продажам', pattern: /recommendations|рекоменда/gi },
    { name: 'ABC-анализ', pattern: /abc.*analysis|абс.*анализ/gi },
    { name: 'Прогноз стоков', pattern: /forecast|прогноз/gi },
    { name: 'Unit-экономика', pattern: /uniteconomics|юнит.*эконом/gi },
  ];

  for (const f of features) {
    const matches = content.match(f.pattern) || [];
    check(
      f.name,
      matches.length > 0 ? 'OK' : 'WARN',
      matches.length > 0 ? `${matches.length} упоминаний` : 'Не найдено'
    );
  }
}

// ============================================
// 4. ПРОАКТИВНЫЕ ПРОМПТЫ
// ============================================
console.log('\n📋 4. ПРОАКТИВНЫЕ ПРОМПТЫ (AI)');
console.log('─────────────────────────────────────────────────────────────────');

const promptPath = 'src/api-lib/agent/prompts/system-v5.ts';
if (existsSync(promptPath)) {
  const content = readFileSync(promptPath, 'utf-8');

  const proactivePatterns = [
    { name: 'Предупреждение об угрозах', pattern: /предупреж|угроз|защит/gi },
    { name: 'Советы по маржинальности', pattern: /маржа|прибыл|profit/gi },
    { name: 'Заботливый тон', pattern: /заботи|помог|поддержк/gi },
    { name: 'Действие без запроса', pattern: /проактив|инициатив|сам|автомат/gi },
  ];

  for (const p of proactivePatterns) {
    const matches = content.match(p.pattern) || [];
    check(p.name, matches.length >= 2 ? 'OK' : 'WARN', `${matches.length} упоминаний`);
  }
}

// ============================================
// 5. АВТОМАТИЧЕСКИЕ ЗАДАЧИ (CRON)
// ============================================
console.log('\n📋 5. АВТОМАТИЧЕСКИЕ ЗАДАЧИ');
console.log('─────────────────────────────────────────────────────────────────');

const cronFiles = [
  { path: 'api/cron/check-prices.ts', name: 'Проверка цен (Sentinel)' },
  { path: 'api/cron/send-daily-report.ts', name: 'Ежедневный отчёт' },
];

for (const f of cronFiles) {
  if (existsSync(f.path)) {
    check(f.name, 'OK', 'Файл существует');
  } else {
    // Check in vercel.json
    check(f.name, 'WARN', 'Файл не найден (может быть в другом месте)');
  }
}

// Check vercel.json for crons
if (existsSync('vercel.json')) {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf-8'));
  if (vercel.crons && vercel.crons.length > 0) {
    check('Vercel Cron Jobs', 'OK', `${vercel.crons.length} задач настроено`);
  } else {
    check('Vercel Cron Jobs', 'WARN', 'Не настроены');
  }
}

// ============================================
// 6. TELEGRAM ПРОДАКТИВНОСТЬ
// ============================================
console.log('\n📋 6. TELEGRAM ПРОАКТИВНОСТЬ');
console.log('─────────────────────────────────────────────────────────────────');

const tgPath = 'src/api-lib/handlers/telegram.ts';
if (existsSync(tgPath)) {
  const content = readFileSync(tgPath, 'utf-8');

  check(
    'Кнопки действий',
    content.includes('inline_keyboard') ? 'OK' : 'FAIL',
    content.includes('inline_keyboard') ? 'Интерактивные кнопки есть' : 'Нет'
  );

  check(
    'Кнопка "Применить цену"',
    content.includes('apply_price') ? 'OK' : 'WARN',
    content.includes('apply_price') ? 'Поддерживается' : 'Не найдено'
  );

  check(
    'Two-step confirmation',
    content.includes('confirm:') ? 'OK' : 'WARN',
    content.includes('confirm:') ? 'Безопасность!' : 'Прямые действия'
  );

  check(
    'WebApp интеграция',
    content.includes('web_app') ? 'OK' : 'WARN',
    content.includes('web_app') ? 'Открытие приложения' : 'Нет'
  );
}

// ============================================
// ИТОГО
// ============================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  📊 ИТОГО ПРОАКТИВНОСТИ');
console.log('═══════════════════════════════════════════════════════════════');

const okCount = checks.filter(c => c.status === 'OK').length;
const warnCount = checks.filter(c => c.status === 'WARN').length;
const failCount = checks.filter(c => c.status === 'FAIL').length;

console.log(`  ✅ Реализовано: ${okCount}`);
console.log(`  ⚠️ Требует внимания: ${warnCount}`);
console.log(`  ❌ Отсутствует: ${failCount}`);

const score = Math.round((okCount / checks.length) * 100);
console.log(`\n  📈 ОЦЕНКА ПРОАКТИВНОСТИ: ${score}%`);

if (score >= 80) {
  console.log('  🏆 ОТЛИЧНО! Viktor AI активно помогает селлеру!');
} else if (score >= 60) {
  console.log('  👍 ХОРОШО, но есть что улучшить');
} else {
  console.log('  🔧 Нужна доработка проактивных функций');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  💤 ПРОВЕРКА ЗАВЕРШЕНА. СПОКОЙНОЙ НОЧИ!');
console.log('═══════════════════════════════════════════════════════════════');
