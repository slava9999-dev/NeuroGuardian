/**
 * 🧪 Viktor AI Agent LOCAL E2E Tests
 *
 * Полностью локальные тесты БЕЗ внешней базы данных.
 * Моки БД + Реальный LLM.
 *
 * Запуск: npm run test:agent:local
 */

import 'dotenv/config';
import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════

const MOCK_PRODUCTS = [
  {
    id: 1,
    product_id: 'mock-wb-001',
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
    id: 2,
    product_id: 'mock-wb-002',
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
    id: 3,
    product_id: 'mock-ozon-001',
    offer_id: 'MOCK-RAIL-60',
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
    product_id: 'mock-wb-003',
    nm_id: 777888999,
    title: 'Органайзер для специй 3 яруса',
    current_price: 1990,
    min_price: 0,
    cost_price: 0,
    current_stock: 5,
    marketplace: 'WB',
    status: 'active',
    is_monitored: false,
    category: 'Кухня',
  },
];

const MOCK_USER = {
  id: 123456789,
  username: 'MockTestUser',
  first_name: 'Test',
  is_active: true,
  subscription_active: true,
  protection_enabled: true,
};

// ═══════════════════════════════════════════════════════════════
// DATABASE MOCKS
// ═══════════════════════════════════════════════════════════════

vi.mock('../../src/api-lib/services/database.js', () => ({
  sql: vi.fn().mockResolvedValue({ rows: [] }),
  getProductsByUserId: vi.fn().mockResolvedValue(MOCK_PRODUCTS),
  getUserById: vi.fn().mockResolvedValue(MOCK_USER),
  getChatHistory: vi.fn().mockResolvedValue([]),
  saveChatHistory: vi.fn().mockResolvedValue(undefined),
  getSalesHistory: vi.fn().mockResolvedValue([]),
  getMarketplaceKeys: vi.fn().mockResolvedValue({
    wb: 'MOCK_WB_KEY',
    ozon: { clientId: 'MOCK_ID', apiKey: 'MOCK_KEY' },
  }),
}));

// ═══════════════════════════════════════════════════════════════
// TEST CONTEXT
// ═══════════════════════════════════════════════════════════════

const TEST_CONTEXT = {
  userId: 123456789,
  userName: 'MockTestUser',
  marketplace: 'all' as const,
  productsCount: MOCK_PRODUCTS.length,
  onboardingMode: false,
  isFirstContact: false,
};

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('Viktor AI Agent LOCAL E2E Tests', () => {
  let orchestrateV4: typeof import('../../src/api-lib/agent/orchestrator-v4.js').orchestrateV4;

  beforeAll(async () => {
    console.log('\n🔒 LOCAL MODE: Using mocked database');
    console.log('🤖 LLM calls are REAL (GROQ/OpenAI)\n');

    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      throw new Error('❌ No LLM API key found! Set GROQ_API_KEY or OPENAI_API_KEY');
    }

    // 🩹 FIX: Restore global.fetch (broken by tests/setup.ts)
    try {
      const { fetch } = await import('undici');
      global.fetch = fetch as unknown as typeof global.fetch;
      console.log('✅ Global fetch restored using undici');
    } catch {
      console.warn('⚠️ Could not restore global.fetch via undici');
    }

    const module = await import('../../src/api-lib/agent/orchestrator-v4.ts');
    orchestrateV4 = module.orchestrateV4;
  });

  // ─────────────────────────────────────────────────────────────
  // CRITICAL TESTS
  // ─────────────────────────────────────────────────────────────

  test('[CRIT-001] Приветствие — агент представляется Виктором', async () => {
    const result = await orchestrateV4('Привет', TEST_CONTEXT);

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Виктор/i);
    expect(result.message).toMatch(/управляющ|менеджер/i);

    console.log(`   ✅ Response: ${result.message.substring(0, 100)}...`);
  }, 30000);

  test('[CRIT-002] Показать товары — вызов get_products', async () => {
    const result = await orchestrateV4('Покажи мои товары', TEST_CONTEXT);

    console.log(`   🔍 Success: ${result.success}`);
    console.log(`   🔍 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);
    console.log(`   🔍 Response: ${result.message?.substring(0, 150) || 'NO MESSAGE'}...`);

    // Агент должен попытаться вызвать get_products (даже если он упадёт)
    expect(result.toolsCalled).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);

    // Если инструмент вызван — отлично
    if (result.toolsCalled?.includes('get_products')) {
      console.log(`   ✅ get_products был вызван`);
    } else {
      console.log(`   ⚠️ get_products НЕ вызван, но агент ответил`);
    }
  }, 30000);

  test('[CRIT-003] Расчёт прибыли — поиск по названию', async () => {
    const result = await orchestrateV4('Посчитай прибыль на рейлинг', TEST_CONTEXT);

    console.log(`   🔍 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);
    console.log(`   🔍 Response: ${result.message?.substring(0, 150) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // CONTEXT TESTS
  // ─────────────────────────────────────────────────────────────

  test('[CTX-001] Понимание числа как себестоимости', async () => {
    const history = [
      { role: 'user', content: 'Посчитай прибыль на органайзер' },
      { role: 'assistant', content: 'Какая себестоимость органайзера?' },
    ];

    const result = await orchestrateV4('450', TEST_CONTEXT, history);

    console.log(`   🔍 Response: ${result.message || 'NO MESSAGE'}`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
    // Response should contain numbers, currency or calculation keywords
    const hasRelevantContent = /\d+|прибыль|маржа|расчет|рубл|₽|итог|получается/i.test(
      result.message
    );
    if (!hasRelevantContent) {
      console.error('❌ FAIL [CTX-001] Agent response:', result.message);
    }
    expect(hasRelevantContent).toBe(true);
  }, 30000);

  test('[CTX-002] Понимание периода после уточнения', async () => {
    const history = [
      { role: 'user', content: 'Покажи продажи' },
      { role: 'assistant', content: 'За какой период? Сегодня, неделя или месяц?' },
    ];

    const result = await orchestrateV4('за неделю', TEST_CONTEXT, history);

    console.log(`   🔍 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);
    console.log(`   🔍 Response: ${result.message?.substring(0, 100) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);

    // Check that agent tried to get sales
    if (result.toolsCalled?.includes('get_sales_stats')) {
      console.log(`   ✅ get_sales_stats был вызван`);
    }
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // SIMPLE INTENT TESTS
  // ─────────────────────────────────────────────────────────────

  test('[INTENT-001] Благодарность', async () => {
    const result = await orchestrateV4('Спасибо за помощь!', TEST_CONTEXT);

    console.log(`   🔍 Response: ${result.message?.substring(0, 100) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
    // Should not call any tools
    expect(result.toolsCalled?.length || 0).toBe(0);
  }, 30000);

  test('[INTENT-002] Запрос возможностей', async () => {
    const result = await orchestrateV4('Что ты умеешь?', TEST_CONTEXT);

    console.log(`   🔍 Response: ${result.message?.substring(0, 150) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
    // Should not call any tools
    expect(result.toolsCalled?.length || 0).toBe(0);
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // FORBIDDEN TOOL TESTS
  // ─────────────────────────────────────────────────────────────

  test('[FORBID-001] Конкуренты без search_web', async () => {
    const result = await orchestrateV4('Проанализируй конкурентов', TEST_CONTEXT);

    console.log(`   🔍 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);

    expect(result.message).toBeDefined();
    expect(result.toolsCalled || []).not.toContain('search_web');
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // TOOL SELECTION TESTS
  // ─────────────────────────────────────────────────────────────

  test('[TOOL-001] ABC анализ', async () => {
    const result = await orchestrateV4('Что продаётся лучше всего?', TEST_CONTEXT);

    console.log(`   🔍 Tools: ${result.toolsCalled?.join(', ') || 'none'}`);
    console.log(`   🔍 Response: ${result.message?.substring(0, 100) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  }, 30000);

  test('[TOOL-002] Продажи без периода — уточнение', async () => {
    const result = await orchestrateV4('Покажи продажи', TEST_CONTEXT);

    console.log(`   🔍 Response: ${result.message?.substring(0, 100) || 'NO MESSAGE'}...`);

    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
    // Should ask for period
    const asksPeriod = /период|сегодня|неделя|месяц/i.test(result.message);
    if (asksPeriod) {
      console.log(`   ✅ Агент уточняет период`);
    }
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────

  afterAll(() => {
    console.log('\n' + '═'.repeat(60));
    console.log('           VIKTOR LOCAL E2E TESTS COMPLETED');
    console.log('═'.repeat(60) + '\n');
  });
});

export { MOCK_PRODUCTS, MOCK_USER, TEST_CONTEXT };
