/**
 * 🧪 Viktor AI Agent Professional E2E Testing Suite
 *
 * PRODUCTION-READY тестирование перед показом клиентам:
 *
 * ✅ Создаёт изолированного тест-юзера в БД
 * ✅ Добавляет тестовые товары
 * ✅ Реальный LLM (GROQ/OpenAI)
 * ✅ Dry-run режим (блокирует опасные операции)
 * ✅ Детальный отчёт с метриками
 * ✅ Автоматическая очистка после тестов
 *
 * Запуск:
 *   npm run test:agent     (стандартный)
 *   npm run test:agent:full (с отчётом)
 *
 * @author NeuroGUARDIAN
 * @version 2.0.0
 */

import 'dotenv/config';
import { sql } from '../../../src/api-lib/services/database.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TEST_USER_ID = 999888777; // Special test user ID
const TEST_USER_NAME = 'ТестПродавец_E2E';
const DRY_RUN = true; // Block all write operations

// ═══════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════

const TEST_PRODUCTS = [
  {
    product_id: `test-wb-${TEST_USER_ID}-001`,
    nm_id: 111222333,
    title: 'Рейлинг для кухни 60см матовый хром',
    current_price: 2500,
    min_price: 2000,
    cost_price: 800,
    current_stock: 45,
    marketplace: 'WB',
    status: 'active',
    is_monitored: true,
    category: 'Кухня',
  },
  {
    product_id: `test-wb-${TEST_USER_ID}-002`,
    nm_id: 444555666,
    title: 'Панно декоративное деревянное 40x60',
    current_price: 4500,
    min_price: 3500,
    cost_price: 1200,
    current_stock: 23,
    marketplace: 'WB',
    status: 'active',
    is_monitored: true,
    category: 'Декор',
  },
  {
    product_id: `test-ozon-${TEST_USER_ID}-001`,
    offer_id: 'TEST-RAIL-60',
    title: 'Держатель для полотенец настенный',
    current_price: 1800,
    min_price: 1500,
    cost_price: 600,
    current_stock: 78,
    marketplace: 'Ozon',
    status: 'active',
    is_monitored: true,
    category: 'Ванная',
  },
  {
    product_id: `test-ozon-${TEST_USER_ID}-002`,
    offer_id: 'TEST-HOOK-5',
    title: 'Крючки настенные самоклеящиеся 5шт',
    current_price: 890,
    min_price: 700,
    cost_price: 150,
    current_stock: 156,
    marketplace: 'Ozon',
    status: 'active',
    is_monitored: false,
    category: 'Аксессуары',
  },
  {
    product_id: `test-wb-${TEST_USER_ID}-003`,
    nm_id: 777888999,
    title: 'Органайзер для специй 3 яруса',
    current_price: 1990,
    min_price: 0, // Not protected
    cost_price: 0, // No cost price set
    current_stock: 5, // Low stock
    marketplace: 'WB',
    status: 'active',
    is_monitored: false,
    category: 'Кухня',
  },
];

// ═══════════════════════════════════════════════════════════════
// DATABASE SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════

export async function setupTestUser(): Promise<void> {
  console.log('📦 Setting up test user and products...');

  // First cleanup any existing test data
  await sql`DELETE FROM products WHERE user_id = ${TEST_USER_ID}`;
  await sql`DELETE FROM users WHERE id = ${TEST_USER_ID}`;

  // Create test user (matching actual schema)
  await sql`
    INSERT INTO users (id, username, first_name, is_active, subscription_active, protection_enabled)
    VALUES (${TEST_USER_ID}, ${TEST_USER_NAME}, 'Test', true, true, true)
  `;

  // Insert test products
  for (const product of TEST_PRODUCTS) {
    await sql`
      INSERT INTO products (
        user_id, product_id, nm_id, offer_id, title, 
        current_price, min_price, cost_price, current_stock,
        marketplace, status, is_monitored, category
      )
      VALUES (
        ${TEST_USER_ID}, ${product.product_id}, ${product.nm_id || null}, ${product.offer_id || null}, ${product.title},
        ${product.current_price}, ${product.min_price}, ${product.cost_price}, ${product.current_stock},
        ${product.marketplace}, ${product.status}, ${product.is_monitored}, ${product.category}
      )
    `;
  }

  console.log(`✅ Created test user ${TEST_USER_ID} with ${TEST_PRODUCTS.length} products`);
}

export async function cleanupTestUser(): Promise<void> {
  console.log('🧹 Cleaning up test data...');

  // Delete test products
  await sql`
    DELETE FROM products WHERE user_id = ${TEST_USER_ID}
  `;

  // Delete test user
  await sql`
    DELETE FROM users WHERE id = ${TEST_USER_ID}
  `;

  console.log('✅ Test data cleaned up');
}

// ═══════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════

export interface TestScenario {
  id: string;
  name: string;
  category: 'read' | 'context' | 'intent' | 'write' | 'edge';
  priority: 'critical' | 'high' | 'medium' | 'low';
  input: string;
  history?: Array<{ role: string; content: string }>;

  // Expectations
  expectedTools?: string[];
  forbiddenTools?: string[];
  requiresConfirmation?: boolean;

  // Validators
  validateResponse?: (response: string) => { pass: boolean; reason: string };
  validatePlan?: (plan: unknown) => { pass: boolean; reason: string };
  validateToolArgs?: (
    toolName: string,
    args: Record<string, unknown>
  ) => { pass: boolean; reason: string };

  // Metadata
  timeout?: number;
  description?: string;
}

export const PROFESSIONAL_SCENARIOS: TestScenario[] = [
  // ═══════════════════════════════════════════════════════════════
  // CRITICAL: Core Functionality
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'CRIT-001',
    name: 'Приветствие и вступление в должность',
    category: 'intent',
    priority: 'critical',
    input: 'Привет',
    expectedTools: [],
    validateResponse: r => {
      const hasViktor = r.includes('Виктор');
      const hasRole = r.includes('управляющ') || r.includes('менеджер');

      if (!hasViktor) return { pass: false, reason: 'Не представился как Виктор' };
      if (!hasRole) return { pass: false, reason: 'Не объяснил свою роль управляющего' };
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен представиться и вступить в должность управляющего',
  },
  {
    id: 'CRIT-002',
    name: 'Показать товары пользователя',
    category: 'read',
    priority: 'critical',
    input: 'Покажи мои товары',
    expectedTools: ['get_products'],
    validateResponse: r => {
      const hasProducts =
        r.includes('рейлинг') ||
        r.includes('Рейлинг') ||
        r.includes('панно') ||
        r.includes('Панно') ||
        r.includes('товар');
      if (!hasProducts) return { pass: false, reason: 'Не показал товары из БД' };
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен получить и отобразить товары из базы данных',
  },
  {
    id: 'CRIT-003',
    name: 'Расчёт прибыли с себестоимостью из БД',
    category: 'read',
    priority: 'critical',
    input: 'Посчитай прибыль на рейлинг',
    expectedTools: ['get_products'],
    validateResponse: r => {
      const hasProfit = r.includes('прибыль') || r.includes('маржа') || r.includes('₽');
      const hasNumbers = /\d+/.test(r);
      if (!hasProfit) return { pass: false, reason: 'Нет расчёта прибыли' };
      if (!hasNumbers) return { pass: false, reason: 'Нет числовых данных' };
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен найти товар по названию и рассчитать прибыль',
  },

  // ═══════════════════════════════════════════════════════════════
  // HIGH: Context Understanding
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'CTX-001',
    name: 'Контекст: ответ числом на вопрос о себестоимости',
    category: 'context',
    priority: 'high',
    history: [
      { role: 'user', content: 'Посчитай прибыль на органайзер' },
      {
        role: 'assistant',
        content:
          'Чтобы точно рассчитать прибыль, мне нужна себестоимость. Какая себестоимость органайзера для специй?',
      },
    ],
    input: '450',
    validateResponse: r => {
      const hasProfit = r.toLowerCase().includes('прибыль');
      const hasNumbers = /\d{2,}/.test(r);
      if (!hasProfit && !hasNumbers) {
        return { pass: false, reason: 'Не распознал 450 как себестоимость' };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен понять что "450" — это ответ на вопрос о себестоимости',
  },
  {
    id: 'CTX-002',
    name: 'Контекст: уточнение периода продаж',
    category: 'context',
    priority: 'high',
    history: [
      { role: 'user', content: 'Покажи продажи' },
      { role: 'assistant', content: 'За какой период показать? Сегодня, неделя или месяц?' },
    ],
    input: 'за неделю',
    expectedTools: ['get_sales_stats'],
    validateToolArgs: (tool, args) => {
      if (tool === 'get_sales_stats') {
        if (args.period === 'week') return { pass: true, reason: 'OK' };
        return { pass: false, reason: `Period should be 'week', got '${args.period}'` };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен понять "за неделю" как ответ на вопрос о периоде',
  },

  // ═══════════════════════════════════════════════════════════════
  // HIGH: Tool Selection
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'TOOL-001',
    name: 'ABC-анализ продаж',
    category: 'read',
    priority: 'high',
    input: 'Что продаётся лучше всего?',
    expectedTools: ['get_abc_analysis'],
    description: 'Агент должен использовать get_abc_analysis для вопроса о лучших продажах',
  },
  {
    id: 'TOOL-002',
    name: 'Поиск товара по названию',
    category: 'read',
    priority: 'high',
    input: 'Найди держатель для полотенец',
    expectedTools: ['get_products'],
    validateToolArgs: (tool, args) => {
      if (tool === 'get_products') {
        const search = String(args.search || '').toLowerCase();
        if (search.includes('держатель') || search.includes('полотенц')) {
          return { pass: true, reason: 'OK' };
        }
        return { pass: false, reason: `Search should contain 'держатель', got '${search}'` };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен искать товар через параметр search',
  },
  {
    id: 'TOOL-003',
    name: 'Запрос продаж БЕЗ периода - уточнение',
    category: 'read',
    priority: 'high',
    input: 'Покажи продажи',
    expectedTools: [], // Should NOT call tool, should ask for period
    validateResponse: r => {
      const asksPeriod =
        r.toLowerCase().includes('период') ||
        r.toLowerCase().includes('сегодня') ||
        r.toLowerCase().includes('неделя') ||
        r.toLowerCase().includes('месяц');
      if (!asksPeriod) {
        return { pass: false, reason: 'Не уточнил период, а должен был спросить' };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен уточнить период, а не вызывать инструмент',
  },
  {
    id: 'TOOL-004',
    name: 'Запрет search_web для конкурентов',
    category: 'read',
    priority: 'high',
    input: 'Проанализируй моих конкурентов',
    forbiddenTools: ['search_web'],
    validateResponse: r => {
      const hasBadLinks =
        r.includes('google.com') ||
        r.includes('yandex.ru') ||
        r.includes('ozon.ru/product') ||
        r.includes('wildberries.ru/catalog');
      if (hasBadLinks) {
        return { pass: false, reason: 'Содержит внешние ссылки вместо анализа товаров' };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент НЕ должен использовать search_web для анализа конкурентов',
  },

  // ═══════════════════════════════════════════════════════════════
  // MEDIUM: Write Operations (DRY-RUN)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'WRITE-001',
    name: 'Установка минимальной цены (требует подтверждения)',
    category: 'write',
    priority: 'medium',
    input: 'Установи минимальную цену 2000 на панно',
    expectedTools: ['set_stop_loss'],
    requiresConfirmation: true,
    description: 'Агент должен запросить подтверждение для изменения min_price',
  },
  {
    id: 'WRITE-002',
    name: 'Массовая защита товаров',
    category: 'write',
    priority: 'medium',
    input: 'Защити все мои товары на 15%',
    expectedTools: ['bulk_protect_products'],
    requiresConfirmation: true,
    description: 'Агент должен запросить подтверждение для bulk операции',
  },

  // ═══════════════════════════════════════════════════════════════
  // LOW: Edge Cases
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'EDGE-001',
    name: 'Благодарность',
    category: 'intent',
    priority: 'low',
    input: 'Спасибо за помощь!',
    expectedTools: [],
    validateResponse: r => {
      const isPolite =
        r.toLowerCase().includes('пожалуйста') ||
        r.toLowerCase().includes('обращайтесь') ||
        r.toLowerCase().includes('рад помочь');
      if (!isPolite) {
        return { pass: false, reason: 'Неполитичный ответ на благодарность' };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен вежливо ответить на благодарность',
  },
  {
    id: 'EDGE-002',
    name: 'Запрос возможностей',
    category: 'intent',
    priority: 'low',
    input: 'Что ты умеешь делать?',
    expectedTools: [],
    validateResponse: r => {
      const hasCapabilities =
        r.includes('прибыль') || r.includes('цен') || r.includes('защит') || r.includes('анализ');
      if (!hasCapabilities) {
        return { pass: false, reason: 'Не перечислил свои возможности' };
      }
      return { pass: true, reason: 'OK' };
    },
    description: 'Агент должен объяснить свои возможности',
  },
  {
    id: 'EDGE-003',
    name: 'Низкий остаток — предупреждение',
    category: 'read',
    priority: 'medium',
    input: 'Какие товары скоро закончатся?',
    expectedTools: ['get_warehouse_stocks', 'get_stock_forecast'],
    description: 'Агент должен найти товары с низким остатком',
  },
];

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { TEST_USER_ID, TEST_USER_NAME, TEST_PRODUCTS, DRY_RUN };
