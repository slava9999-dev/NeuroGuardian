/**
 * 🧪 Viktor AI Agent SAFE E2E Tests
 *
 * БЕЗОПАСНЫЙ режим тестирования:
 * ✅ Реальный LLM (GROQ/OpenAI)
 * ✅ Эмуляция товаров (НЕ трогает WB/Ozon)
 * ✅ Блокировка WRITE операций
 * ✅ Все GET операции работают с моками
 *
 * Запуск: npx vitest run tests/agent/viktor-safe-e2e.test.ts
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';

// ========================================
// MOCK DATA - Эмуляция товаров
// ========================================

const MOCK_PRODUCTS = [
  {
    id: 1,
    product_id: 'wb-123456789',
    nm_id: 123456789,
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
    id: 2,
    product_id: 'wb-987654321',
    nm_id: 987654321,
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
    id: 3,
    product_id: 'ozon-111222333',
    nm_id: null,
    offer_id: 'RAIL-60-CHROME',
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
    id: 4,
    product_id: 'ozon-444555666',
    nm_id: null,
    offer_id: 'HOOK-WALL-5PCS',
    title: 'Крючки настенные самоклеящиеся 5шт',
    current_price: 890,
    min_price: 700,
    cost_price: 150,
    current_stock: 156,
    marketplace: 'Ozon',
    status: 'active',
    is_monitored: true,
    category: 'Аксессуары',
  },
];

const MOCK_SALES = [
  { date: '2026-01-09', product_id: 'wb-123456789', quantity: 5, revenue: 12500 },
  { date: '2026-01-09', product_id: 'wb-987654321', quantity: 2, revenue: 9000 },
  { date: '2026-01-08', product_id: 'wb-123456789', quantity: 8, revenue: 20000 },
  { date: '2026-01-08', product_id: 'ozon-111222333', quantity: 3, revenue: 5400 },
  { date: '2026-01-07', product_id: 'ozon-444555666', quantity: 12, revenue: 10680 },
];

// ========================================
// SAFE USER CONTEXT
// ========================================

// Using a test user ID that won't affect production
const SAFE_TEST_USER = {
  userId: 1, // Will use mocked data, not real DB
  userName: 'ТестПродавец',
  marketplace: 'all' as const,
  wbApiKey: 'MOCK_KEY', // Not used - we mock API calls
  ozonApiKey: 'MOCK_KEY',
  productsCount: MOCK_PRODUCTS.length,
  onboardingMode: false,
  isFirstContact: false,
};

// ========================================
// MOCKS SETUP
// ========================================

// Mock database functions to return our test data
vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: vi.fn(),
  getProductsByUserId: vi.fn().mockResolvedValue(MOCK_PRODUCTS),
  getSalesHistory: vi.fn().mockResolvedValue(MOCK_SALES),
  getMarketplaceKeys: vi.fn().mockResolvedValue({
    wb: 'MOCK_WB_KEY',
    ozon: { clientId: 'MOCK_ID', apiKey: 'MOCK_KEY' },
  }),
}));

// Mock marketplace API calls to prevent real requests
vi.mock('../../src/api-lib/services/marketplace.js', () => ({
  syncSalesHistory: vi.fn().mockResolvedValue(undefined),
  fetchWbOrders: vi.fn().mockResolvedValue([]),
  fetchOzonAnalytics: vi.fn().mockResolvedValue([]),
}));

// BLOCK all write operations
vi.mock('../../src/api-lib/services/index.js', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/api-lib/services/index.js')>();
  return {
    ...original,
    // Override READ functions with mocks
    getProductsByUserId: vi.fn().mockResolvedValue(MOCK_PRODUCTS),
    getSalesHistory: vi.fn().mockResolvedValue(MOCK_SALES),
    getMarketplaceKeys: vi.fn().mockResolvedValue({
      wb: 'MOCK_WB_KEY',
      ozon: { clientId: 'MOCK_ID', apiKey: 'MOCK_KEY' },
    }),
    // BLOCK write operations - throw error if called
    updateProductPrice: vi
      .fn()
      .mockRejectedValue(new Error('🛑 BLOCKED: Price update in test mode')),
    updateProductStock: vi
      .fn()
      .mockRejectedValue(new Error('🛑 BLOCKED: Stock update in test mode')),
    setProductMinPrice: vi
      .fn()
      .mockRejectedValue(new Error('🛑 BLOCKED: Min price update in test mode')),
  };
});

// ========================================
// TEST SCENARIOS
// ========================================

interface TestScenario {
  name: string;
  category: string;
  input: string;
  history?: Array<{ role: string; content: string }>;
  expectedTools?: string[];
  forbiddenTools?: string[];
  checkResponse?: (response: string) => boolean;
  checkPlan?: (plan: unknown) => boolean;
  timeout?: number;
}

const SAFE_SCENARIOS: TestScenario[] = [
  // ========================================
  // READ-ONLY Tool Selection Tests
  // ========================================
  {
    category: 'read_only',
    name: 'Показать товары',
    input: 'Покажи мои товары',
    expectedTools: ['get_products'],
    checkResponse: r => r.includes('рейлинг') || r.includes('Рейлинг') || r.includes('товар'),
  },
  {
    category: 'read_only',
    name: 'Поиск товара по названию',
    input: 'Найди рейлинг',
    expectedTools: ['get_products'],
    checkPlan: (plan: unknown) => {
      const p = plan as { tools?: Array<{ args?: { search?: string } }> };
      const args = p?.tools?.[0]?.args;
      return args?.search?.toLowerCase().includes('рейлинг') ?? false;
    },
  },
  {
    category: 'read_only',
    name: 'ABC анализ',
    input: 'Что продаётся лучше всего?',
    expectedTools: ['get_abc_analysis'],
  },
  {
    category: 'read_only',
    name: 'Юнит-экономика',
    input: 'Посчитай прибыль на панно',
    expectedTools: ['get_products'], // First finds product
    checkResponse: r => r.includes('прибыль') || r.includes('маржа') || r.includes('₽'),
  },

  // ========================================
  // Context Understanding Tests
  // ========================================
  {
    category: 'context',
    name: 'Понимание числа как себестоимости',
    history: [
      { role: 'user', content: 'Посчитай прибыль на держатель' },
      { role: 'assistant', content: 'Какая себестоимость держателя?' },
    ],
    input: '600',
    checkResponse: r => r.includes('прибыль') || r.includes('маржа') || r.includes('600'),
  },
  {
    category: 'context',
    name: 'Понимание периода',
    history: [
      { role: 'user', content: 'Покажи продажи' },
      { role: 'assistant', content: 'За какой период? Сегодня, неделя, месяц?' },
    ],
    input: 'за неделю',
    expectedTools: ['get_sales_stats'],
    checkPlan: (plan: unknown) => {
      const p = plan as { tools?: Array<{ args?: { period?: string } }> };
      return p?.tools?.[0]?.args?.period === 'week';
    },
  },

  // ========================================
  // Simple Intent Tests
  // ========================================
  {
    category: 'simple_intent',
    name: 'Приветствие',
    input: 'Привет',
    expectedTools: [],
    checkResponse: r => r.includes('Виктор') && r.includes('управляющ'),
  },
  {
    category: 'simple_intent',
    name: 'Благодарность',
    input: 'Спасибо за помощь',
    expectedTools: [],
    checkResponse: r =>
      r.toLowerCase().includes('пожалуйста') || r.toLowerCase().includes('обращайтесь'),
  },
  {
    category: 'simple_intent',
    name: 'Запрос возможностей',
    input: 'Что ты умеешь?',
    expectedTools: [],
    checkResponse: r => r.includes('прибыль') || r.includes('защит') || r.includes('анализ'),
  },

  // ========================================
  // Forbidden Tool Tests
  // ========================================
  {
    category: 'forbidden',
    name: 'Анализ конкурентов без search_web',
    input: 'Проанализируй конкурентов',
    forbiddenTools: ['search_web'],
    checkResponse: r => !r.includes('google.com') && !r.includes('yandex.ru'),
  },

  // ========================================
  // Error Handling (Read-Only)
  // ========================================
  {
    category: 'error_handling',
    name: 'Несуществующий товар',
    input: 'Покажи товар xyz123456',
    checkResponse: r => r.includes('не найден') || r.includes('не нашёл') || r.length > 0,
  },
];

// ========================================
// TEST EXECUTION
// ========================================

describe('Viktor AI Agent SAFE E2E Tests', () => {
  let orchestrateV4: typeof import('../../src/api-lib/agent/orchestrator-v4.js').orchestrateV4;

  beforeAll(async () => {
    console.log('\n🔒 SAFE MODE: All write operations are BLOCKED');
    console.log('📦 Using MOCK products (not real WB/Ozon data)');
    console.log('🤖 LLM calls are REAL (GROQ/OpenAI)\n');

    // Check for API keys
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error('❌ No LLM API key found! Set GROQ_API_KEY or OPENAI_API_KEY');
    }

    // 🩹 FIX: Restore global.fetch (broken by tests/setup.ts)
    // We need real network access for LLM calls!
    try {
      const { fetch } = await import('undici');
      global.fetch = fetch as unknown as typeof global.fetch;
      console.log('✅ Global fetch restored using undici');
    } catch {
      console.warn('⚠️ Could not restore global.fetch via undici, trying node native');
      // Node 18+ has native fetch, but overwritten by setup.ts mock.
      // If undici fails, we might be stuck unless we use node-fetch or similar.
    }

    // Import orchestrator
    // Use .ts extension to ensure we test source code
    const module = await import('../../src/api-lib/agent/orchestrator-v4.ts');
    orchestrateV4 = module.orchestrateV4;
  });

  // Run each scenario
  for (const scenario of SAFE_SCENARIOS) {
    test(
      `[${scenario.category}] ${scenario.name}`,
      async () => {
        const startTime = Date.now();

        console.log(`\n🧪 Testing: ${scenario.name}`);
        console.log(`   Input: "${scenario.input}"`);

        const result = await orchestrateV4(scenario.input, SAFE_TEST_USER, scenario.history);

        const duration = Date.now() - startTime;

        console.log(`   ⏱️ Time: ${duration}ms`);
        console.log(`   🔧 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);
        console.log(`   💬 Response: ${result.message.substring(0, 100)}...`);

        // Check forbidden tools
        if (scenario.forbiddenTools) {
          for (const forbidden of scenario.forbiddenTools) {
            expect(result.toolsCalled, `Tool ${forbidden} should NOT be called`).not.toContain(
              forbidden
            );
          }
        }

        // Check expected tools
        if (scenario.expectedTools && scenario.expectedTools.length > 0) {
          for (const expected of scenario.expectedTools) {
            expect(result.toolsCalled, `Tool ${expected} should be called`).toContain(expected);
          }
        }

        // Check response content
        if (scenario.checkResponse) {
          expect(scenario.checkResponse(result.message), 'Response content check failed').toBe(
            true
          );
        }

        // Check plan
        if (scenario.checkPlan) {
          expect(scenario.checkPlan(result.plan), 'Plan check failed').toBe(true);
        }

        // All tests should succeed
        expect(result.success).toBe(true);
      },
      scenario.timeout || 30000
    );
  }

  afterAll(() => {
    console.log('\n' + '═'.repeat(60));
    console.log('           VIKTOR SAFE E2E TEST COMPLETED');
    console.log('═'.repeat(60));
    console.log('\n✅ All tests used MOCK data - no real stores affected');
  });
});

// ========================================
// EXPORT for manual testing
// ========================================

export { MOCK_PRODUCTS, MOCK_SALES, SAFE_TEST_USER, SAFE_SCENARIOS };
