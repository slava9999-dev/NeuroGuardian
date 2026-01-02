#!/usr/bin/env npx tsx
/**
 * 🧪 ТЕСТ ИНСТРУМЕНТОВ ВИКТОРА
 * Проверяем: search_web, get_competitor_price, extractNmIdFromUrl
 * Запуск: npx tsx scripts/test-viktor-tools.ts
 */

import 'dotenv/config';

console.log('═══════════════════════════════════════════════════════════════');
console.log('  🤖 ТЕСТ ИНСТРУМЕНТОВ ВИКТОРА ИИ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

// ============================================
// TEST 1: extractNmIdFromUrl
// ============================================
console.log('📋 ТЕСТ 1: Извлечение артикула из URL');
console.log('─────────────────────────────────────────────────────────────────');

// Динамический импорт
const { extractNmIdFromUrl } = await import('../src/api-lib/services/competitor-monitor.js');

const testUrls = [
  { input: '123456789', expected: 123456789, desc: 'Просто nm_id' },
  {
    input: 'https://www.wildberries.ru/catalog/123456789/detail.aspx',
    expected: 123456789,
    desc: 'Полный URL WB',
  },
  { input: 'wildberries.ru/catalog/987654321', expected: 987654321, desc: 'Короткий URL WB' },
  {
    input: 'https://www.wildberries.ru/catalog/111222333/detail.aspx?targetUrl=XY',
    expected: 111222333,
    desc: 'URL с параметрами',
  },
  { input: 'invalid_url', expected: null, desc: 'Невалидный URL' },
];

let passed = 0;
let failed = 0;

for (const test of testUrls) {
  const result = extractNmIdFromUrl(test.input);
  const success = result === test.expected;

  if (success) {
    console.log(`  ✅ ${test.desc}: ${test.input} → ${result}`);
    passed++;
  } else {
    console.log(`  ❌ ${test.desc}: ${test.input} → ${result} (ожидалось: ${test.expected})`);
    failed++;
  }
}

console.log(`\n  Результат: ${passed}/${testUrls.length} тестов пройдено`);
console.log('');

// ============================================
// TEST 2: get_competitor_price (WB)
// ============================================
console.log('📋 ТЕСТ 2: Получение цены конкурента (Wildberries)');
console.log('─────────────────────────────────────────────────────────────────');

const { fetchWbCompetitorData } = await import('../src/api-lib/services/competitor-monitor.js');

// Тестовый товар: популярный товар на WB (панно деревянное)
const testNmId = 178291699; // Реальный артикул товара на WB

console.log(`  🔍 Проверяем товар nm_id=${testNmId}...`);

try {
  const competitorData = await fetchWbCompetitorData(testNmId);

  if (competitorData) {
    console.log(`  ✅ Данные получены!`);
    console.log(`     📦 Артикул: ${competitorData.nmId}`);
    console.log(`     💰 Цена: ${competitorData.price}₽`);
    console.log(`     💵 Базовая цена: ${competitorData.basicPrice}₽`);
    console.log(`     📊 В наличии: ${competitorData.available ? 'Да' : 'Нет'}`);
    console.log(`     📦 Остаток: ${competitorData.stock} шт`);
  } else {
    console.log(`  ⚠️ Товар не найден (возможно снят с продажи)`);
  }
} catch (error) {
  console.log(`  ❌ Ошибка: ${error}`);
}

console.log('');

// ============================================
// TEST 3: search_web (Serper API)
// ============================================
console.log('📋 ТЕСТ 3: Интернет-поиск (Serper API)');
console.log('─────────────────────────────────────────────────────────────────');

// Проверяем наличие API ключа
const serperKey = process.env.SERPER_API_KEY;

if (!serperKey) {
  console.log('  ⚠️ SERPER_API_KEY не найден в .env');
  console.log('  💡 Для работы интернет-поиска нужен ключ от serper.dev');
} else {
  console.log('  ✅ SERPER_API_KEY найден');

  // Тестовый поиск
  const testQuery = 'Wildberries комиссии 2025';
  console.log(`  🔍 Поиск: "${testQuery}"...`);

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: testQuery,
        gl: 'ru',
        hl: 'ru',
        num: 3,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        organic?: Array<{ title: string; link: string; snippet: string }>;
      };
      console.log(`  ✅ Поиск работает!`);
      console.log(`  📊 Найдено результатов: ${data.organic?.length || 0}`);

      if (data.organic && data.organic.length > 0) {
        console.log(`\n  Топ-3 результата:`);
        for (let i = 0; i < Math.min(3, data.organic.length); i++) {
          const r = data.organic[i];
          console.log(`  ${i + 1}. ${r.title}`);
          console.log(`     ${r.link}`);
        }
      }
    } else {
      const errorText = await response.text();
      console.log(`  ❌ Ошибка API: ${response.status}`);
      console.log(`     ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`  ❌ Ошибка запроса: ${error}`);
  }
}

console.log('');

// ============================================
// TEST 4: LLM Connection (Groq)
// ============================================
console.log('📋 ТЕСТ 4: Подключение к LLM (Groq)');
console.log('─────────────────────────────────────────────────────────────────');

const groqKey = process.env.GROQ_API_KEY;

if (!groqKey) {
  console.log('  ⚠️ GROQ_API_KEY не найден в .env');
} else {
  console.log('  ✅ GROQ_API_KEY найден');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
    });

    if (response.ok) {
      const data = (await response.json()) as { data?: Array<{ id: string }> };
      console.log(`  ✅ Groq API доступен!`);
      console.log(`  📊 Доступные модели: ${data.data?.length || 0}`);

      // Найти нашу модель
      const ourModel = data.data?.find((m: { id: string }) => m.id === 'llama-3.3-70b-versatile');
      if (ourModel) {
        console.log(`  ✅ llama-3.3-70b-versatile доступна`);
      } else {
        console.log(`  ⚠️ llama-3.3-70b-versatile не найдена в списке`);
      }
    } else {
      console.log(`  ❌ Ошибка API: ${response.status}`);
    }
  } catch (error) {
    console.log(`  ❌ Ошибка подключения: ${error}`);
  }
}

console.log('');

// ============================================
// SUMMARY
// ============================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('  📊 ИТОГО');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  • Извлечение URL: ${passed}/${testUrls.length} тестов`);
console.log(`  • Цена конкурента: ${competitorData ? '✅' : '⚠️'}`);
console.log(`  • Интернет-поиск: ${serperKey ? '✅ API ключ есть' : '❌ Нет ключа'}`);
console.log(`  • LLM (Groq): ${groqKey ? '✅ API ключ есть' : '❌ Нет ключа'}`);
console.log('═══════════════════════════════════════════════════════════════');

// Exit with appropriate code
const competitorData = await fetchWbCompetitorData(testNmId);
const hasIssues = failed > 0 || !competitorData || !serperKey || !groqKey;
process.exit(hasIssues ? 1 : 0);
