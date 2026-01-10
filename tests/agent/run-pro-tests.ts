/**
 * 🧪 Viktor AI Agent — Professional E2E Test Suite
 *
 * PRODUCTION-READY тестирование агента:
 * ✅ Локальная тестовая БД (Docker Postgres)
 * ✅ Реальный LLM (GROQ/OpenAI)
 * ✅ Полная изоляция от production
 * ✅ Строгие проверки всех критических функций
 * ✅ CI/CD совместимость
 *
 * Запуск:
 *   npm run test:agent:pro
 *
 * Предварительно:
 *   docker run -d --name neuroguardian-test-db \
 *     -e POSTGRES_USER=testuser \
 *     -e POSTGRES_PASSWORD=testpass123 \
 *     -e POSTGRES_DB=neuroguardian_test \
 *     -p 5433:5432 postgres:15-alpine
 */

import 'dotenv/config';

// Override POSTGRES_URL for test database
process.env.POSTGRES_URL = 'postgresql://testuser:testpass123@localhost:5433/neuroguardian_test';

import pkg from 'pg';
const { Pool } = pkg;

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TEST_USER_ID = 999888777;
const TEST_USER_NAME = 'ТестПродавец_E2E';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const TEST_PRODUCTS = [
  {
    product_id: `test-wb-001`,
    nm_id: 111222333,
    title: 'Рейлинг для кухни 60см матовый хром',
    current_price: 2500,
    min_price: 2000,
    cost_price: 800,
    current_stock: 45,
    marketplace: 'WB',
    is_monitored: true,
  },
  {
    product_id: `test-wb-002`,
    nm_id: 444555666,
    title: 'Панно декоративное деревянное 40x60',
    current_price: 4500,
    min_price: 3500,
    cost_price: 1200,
    current_stock: 23,
    marketplace: 'WB',
    is_monitored: true,
  },
  {
    product_id: `test-ozon-001`,
    offer_id: 'TEST-RAIL-60',
    title: 'Держатель для полотенец настенный',
    current_price: 1800,
    min_price: 1500,
    cost_price: 600,
    current_stock: 78,
    marketplace: 'Ozon',
    is_monitored: true,
  },
  {
    product_id: `test-wb-003`,
    nm_id: 777888999,
    title: 'Органайзер для специй 3 яруса',
    current_price: 1990,
    min_price: 0,
    cost_price: 0,
    current_stock: 5,
    marketplace: 'WB',
    is_monitored: false,
  },
];

// ═══════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════

interface TestScenario {
  id: string;
  name: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  input: string;
  history?: Array<{ role: string; content: string }>;
  assertions: (result: TestResult) => AssertionResult[];
}

interface TestResult {
  success: boolean;
  message: string;
  toolsCalled: string[];
  plan?: { tools?: Array<{ tool: string; args?: Record<string, unknown> }> };
  totalTimeMs: number;
}

interface AssertionResult {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

const SCENARIOS: TestScenario[] = [
  // ═══════════════════════════════════════════════════════════════
  // CRITICAL — Обязательно должны проходить перед релизом
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'CRIT-001',
    name: 'Приветствие и вступление в должность',
    category: 'critical',
    input: 'Привет',
    assertions: r => [
      {
        name: 'Агент ответил',
        passed: r.message.length > 0,
        expected: 'non-empty',
        actual: `${r.message.length} chars`,
      },
      {
        name: 'Представился Виктором',
        passed: /Виктор/i.test(r.message),
        expected: 'contains "Виктор"',
        actual: r.message.substring(0, 50),
      },
      {
        name: 'Объяснил роль',
        passed: /управляющ|менеджер/i.test(r.message),
        expected: 'mentions role',
        actual: r.message.substring(0, 100),
      },
      {
        name: 'Не вызывал инструменты',
        passed: r.toolsCalled.length === 0,
        expected: '0 tools',
        actual: `${r.toolsCalled.length} tools`,
      },
    ],
  },
  {
    id: 'CRIT-002',
    name: 'Показать товары пользователя',
    category: 'critical',
    input: 'Покажи мои товары',
    assertions: r => [
      {
        name: 'Агент ответил',
        passed: r.message.length > 0,
        expected: 'non-empty',
        actual: `${r.message.length} chars`,
      },
      {
        name: 'Вызвал get_products',
        passed: r.toolsCalled.includes('get_products'),
        expected: 'get_products called',
        actual: r.toolsCalled.join(', ') || 'none',
      },
      {
        name: 'Упомянул товары',
        passed: /товар|рейлинг|панно/i.test(r.message),
        expected: 'mentions products',
        actual: r.message.substring(0, 100),
      },
    ],
  },
  {
    id: 'CRIT-003',
    name: 'Поиск товара по названию',
    category: 'critical',
    input: 'Найди рейлинг',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Вызвал get_products', passed: r.toolsCalled.includes('get_products') },
      {
        name: 'Передал search параметр',
        passed:
          r.plan?.tools?.some(
            t => t.tool === 'get_products' && /рейлинг/i.test(String(t.args?.search || ''))
          ) || false,
        expected: 'search contains "рейлинг"',
        actual: JSON.stringify(r.plan?.tools?.[0]?.args),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // HIGH — Важные функции
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'HIGH-001',
    name: 'Понимание числа как себестоимости',
    category: 'high',
    history: [
      { role: 'user', content: 'Посчитай прибыль на органайзер' },
      {
        role: 'assistant',
        content:
          'Чтобы рассчитать прибыль, мне нужна себестоимость. Какая себестоимость органайзера?',
      },
    ],
    input: '450',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Понял как себестоимость', passed: /прибыль|маржа|450|₽/i.test(r.message) },
    ],
  },
  {
    id: 'HIGH-002',
    name: 'Понимание периода после уточнения',
    category: 'high',
    history: [
      { role: 'user', content: 'Покажи продажи' },
      { role: 'assistant', content: 'За какой период? Сегодня, неделя или месяц?' },
    ],
    input: 'за неделю',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Вызвал get_sales_stats', passed: r.toolsCalled.includes('get_sales_stats') },
      {
        name: 'Передал period=week',
        passed:
          r.plan?.tools?.some(t => t.tool === 'get_sales_stats' && t.args?.period === 'week') ||
          false,
        expected: 'period: "week"',
        actual: JSON.stringify(r.plan?.tools?.find(t => t.tool === 'get_sales_stats')?.args),
      },
    ],
  },
  {
    id: 'HIGH-003',
    name: 'Уточнение периода при запросе продаж',
    category: 'high',
    input: 'Покажи продажи',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      {
        name: 'Уточняет период',
        passed: /период|сегодня|неделя|месяц/i.test(r.message),
        expected: 'asks for period',
        actual: r.message.substring(0, 100),
      },
      {
        name: 'НЕ вызывает инструмент без периода',
        passed: !r.toolsCalled.includes('get_sales_stats'),
        expected: 'no get_sales_stats',
        actual: r.toolsCalled.join(', ') || 'none',
      },
    ],
  },
  {
    id: 'HIGH-004',
    name: 'Запрет search_web для конкурентов',
    category: 'high',
    input: 'Проанализируй моих конкурентов',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      {
        name: 'НЕ использует search_web',
        passed: !r.toolsCalled.includes('search_web'),
        expected: 'no search_web',
        actual: r.toolsCalled.join(', ') || 'none',
      },
      {
        name: 'Нет внешних ссылок',
        passed: !/google\.com|yandex\.ru|ozon\.ru\/product|wildberries\.ru\/catalog/i.test(
          r.message
        ),
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // MEDIUM — Дополнительные проверки
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'MED-001',
    name: 'ABC анализ',
    category: 'medium',
    input: 'Что продаётся лучше всего?',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Вызвал get_abc_analysis', passed: r.toolsCalled.includes('get_abc_analysis') },
    ],
  },
  {
    id: 'MED-002',
    name: 'Благодарность',
    category: 'medium',
    input: 'Спасибо за помощь!',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Вежливый ответ', passed: /пожалуйста|обращайтесь|рад/i.test(r.message) },
      { name: 'Нет инструментов', passed: r.toolsCalled.length === 0 },
    ],
  },
  {
    id: 'MED-003',
    name: 'Запрос возможностей',
    category: 'medium',
    input: 'Что ты умеешь?',
    assertions: r => [
      { name: 'Агент ответил', passed: r.message.length > 0 },
      { name: 'Описал возможности', passed: /прибыль|анализ|защит|цен|товар/i.test(r.message) },
      { name: 'Нет инструментов', passed: r.toolsCalled.length === 0 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// DATABASE SETUP
// ═══════════════════════════════════════════════════════════════

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 5,
});

async function setupDatabase() {
  console.log(`\n${colors.cyan}📦 Setting up test database...${colors.reset}`);

  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        protection_enabled BOOLEAN DEFAULT false,
        subscription_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id VARCHAR(255) NOT NULL,
        nm_id BIGINT,
        offer_id VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        current_price INTEGER NOT NULL,
        min_price INTEGER DEFAULT 0,
        cost_price INTEGER DEFAULT 0,
        current_stock INTEGER DEFAULT 0,
        marketplace VARCHAR(50) NOT NULL,
        is_monitored BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        messages JSONB NOT NULL DEFAULT '[]'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id),
        marketplace VARCHAR(20) NOT NULL,
        order_id VARCHAR(255) NOT NULL,
        order_date TIMESTAMP NOT NULL,
        price_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, marketplace, order_id)
      )
    `);

    // Cleanup previous test data
    await client.query(`DELETE FROM products WHERE user_id = $1`, [TEST_USER_ID]);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);

    // Insert test user
    await client.query(
      `
      INSERT INTO users (id, username, first_name, is_active, subscription_active, protection_enabled)
      VALUES ($1, $2, 'Test', true, true, true)
    `,
      [TEST_USER_ID, TEST_USER_NAME]
    );

    // Insert test products
    for (const p of TEST_PRODUCTS) {
      await client.query(
        `
        INSERT INTO products (user_id, product_id, nm_id, offer_id, title, current_price, min_price, cost_price, current_stock, marketplace, is_monitored)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
        [
          TEST_USER_ID,
          p.product_id,
          p.nm_id || null,
          p.offer_id || null,
          p.title,
          p.current_price,
          p.min_price,
          p.cost_price,
          p.current_stock,
          p.marketplace,
          p.is_monitored,
        ]
      );
    }

    console.log(
      `${colors.green}✓ Test database ready with ${TEST_PRODUCTS.length} products${colors.reset}`
    );
  } finally {
    client.release();
  }
}

async function cleanupDatabase() {
  console.log(`\n${colors.cyan}🧹 Cleaning up test data...${colors.reset}`);

  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM products WHERE user_id = $1`, [TEST_USER_ID]);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);
    console.log(`${colors.green}✓ Test data cleaned${colors.reset}`);
  } finally {
    client.release();
    await pool.end();
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════

interface ScenarioResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  assertions: AssertionResult[];
  duration: number;
  error?: string;
}

async function runTests(): Promise<ScenarioResult[]> {
  const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4.js');

  const context = {
    userId: TEST_USER_ID,
    userName: TEST_USER_NAME,
    marketplace: 'all' as const,
    productsCount: TEST_PRODUCTS.length,
    onboardingMode: false,
    isFirstContact: false,
  };

  const results: ScenarioResult[] = [];

  console.log(`\n${'═'.repeat(70)}`);
  console.log(
    `${colors.bright}${colors.cyan}   🧪 VIKTOR AI AGENT — PROFESSIONAL E2E TESTS${colors.reset}`
  );
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n📊 Running ${SCENARIOS.length} test scenarios...`);
  console.log(`👤 Test user: ${TEST_USER_ID} with ${TEST_PRODUCTS.length} products`);
  console.log(
    `🔑 LLM: ${process.env.GROQ_API_KEY ? 'GROQ' : process.env.OPENAI_API_KEY ? 'OpenAI' : 'NONE'}`
  );

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    const progress = `[${i + 1}/${SCENARIOS.length}]`;

    console.log(
      `\n${colors.gray}─────────────────────────────────────────────────────${colors.reset}`
    );
    console.log(`${progress} ${colors.bright}${scenario.id}${colors.reset}: ${scenario.name}`);
    console.log(`   ${colors.gray}Category: ${scenario.category}${colors.reset}`);

    const startTime = Date.now();

    try {
      const response = (await orchestrateV4(
        scenario.input,
        context,
        scenario.history
      )) as TestResult;

      const duration = Date.now() - startTime;
      const assertions = scenario.assertions(response);
      const allPassed = assertions.every(a => a.passed);

      results.push({
        id: scenario.id,
        name: scenario.name,
        category: scenario.category,
        passed: allPassed,
        assertions,
        duration,
      });

      if (allPassed) {
        console.log(`   ${colors.green}✓ PASSED${colors.reset} (${duration}ms)`);
      } else {
        console.log(`   ${colors.red}✗ FAILED${colors.reset} (${duration}ms)`);
        for (const a of assertions.filter(a => !a.passed)) {
          console.log(`     ${colors.red}→ ${a.name}${colors.reset}`);
          if (a.expected) console.log(`       Expected: ${a.expected}`);
          if (a.actual) console.log(`       Actual: ${a.actual}`);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({
        id: scenario.id,
        name: scenario.name,
        category: scenario.category,
        passed: false,
        assertions: [],
        duration,
        error: String(error),
      });
      console.log(`   ${colors.red}✗ ERROR${colors.reset}: ${error}`);
    }
  }

  return results;
}

function printReport(results: ScenarioResult[]) {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n\n${'═'.repeat(70)}`);
  console.log(`${colors.bright}${colors.cyan}   📊 TEST REPORT${colors.reset}`);
  console.log(`${'═'.repeat(70)}`);

  const passRate = Math.round((passed.length / results.length) * 100);
  const passColor = passRate >= 80 ? colors.green : passRate >= 50 ? colors.yellow : colors.red;

  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  console.log(`   Total:    ${results.length} scenarios`);
  console.log(`   Passed:   ${colors.green}${passed.length}${colors.reset}`);
  console.log(`   Failed:   ${colors.red}${failed.length}${colors.reset}`);
  console.log(`   Rate:     ${passColor}${passRate}%${colors.reset}`);
  console.log(`   Duration: ${(totalTime / 1000).toFixed(2)}s`);

  // By category
  console.log(`\n${colors.bright}By Category:${colors.reset}`);
  const categories = ['critical', 'high', 'medium', 'low'];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    if (catResults.length === 0) continue;
    const catPassed = catResults.filter(r => r.passed).length;
    const icon = catPassed === catResults.length ? '✅' : cat === 'critical' ? '🔴' : '⚠️';
    console.log(`   ${icon} ${cat}: ${catPassed}/${catResults.length}`);
  }

  // Critical failures
  const criticalFailed = failed.filter(f => f.category === 'critical');
  if (criticalFailed.length > 0) {
    console.log(`\n${colors.red}${colors.bright}⚠️  CRITICAL FAILURES:${colors.reset}`);
    for (const f of criticalFailed) {
      console.log(`   ${colors.red}✗ ${f.id}: ${f.name}${colors.reset}`);
    }
  }

  // Final verdict
  console.log(`\n${'═'.repeat(70)}`);
  if (criticalFailed.length > 0) {
    console.log(
      `${colors.red}${colors.bright}   ❌ AGENT NOT READY — CRITICAL FAILURES${colors.reset}`
    );
  } else if (passRate >= 80) {
    console.log(`${colors.green}${colors.bright}   ✅ AGENT READY FOR PRODUCTION${colors.reset}`);
  } else if (passRate >= 60) {
    console.log(`${colors.yellow}${colors.bright}   ⚠️  AGENT NEEDS FIXES${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}   ❌ AGENT NOT READY${colors.reset}`);
  }
  console.log(`${'═'.repeat(70)}\n`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  try {
    // Check for LLM key
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error(
        `${colors.red}❌ No LLM API key found! Set GROQ_API_KEY or OPENAI_API_KEY${colors.reset}`
      );
      process.exit(1);
    }

    await setupDatabase();
    const results = await runTests();
    printReport(results);
    await cleanupDatabase();

    // Exit code
    const criticalFailed = results.filter(r => !r.passed && r.category === 'critical').length;
    const totalFailed = results.filter(r => !r.passed).length;

    if (criticalFailed > 0) {
      process.exit(2); // Critical failure
    } else if (totalFailed > 0) {
      process.exit(1); // Some failures
    } else {
      process.exit(0); // All passed
    }
  } catch (error) {
    console.error(`${colors.red}❌ Fatal error: ${error}${colors.reset}`);
    try {
      await cleanupDatabase();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

main();
