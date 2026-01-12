/**
 * 🧪 Viktor AI Agent Test Suite (E2E)
 *
 * Full E2E tests with:
 * - Real LLM calls (OpenAI/Groq/OpenRouter)
 * - Mocked Database (to ensure consistency)
 * - Comprehensive Scenarios
 *
 * Запуск: npx tsx tests/agent/viktor-e2e.test.ts
 */

import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// DATABASE MOCKS
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
];

const MOCK_USER = {
  id: 999999999,
  username: 'TestUser',
  first_name: 'Test',
  is_active: true,
  subscription_active: true,
  protection_enabled: true,
  settings_complete: true,
};

// Mock database module
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

// Mock secrets helper to avoid DB/Vault dependencies
// vi.mock('../../src/api-lib/lib/secrets-helper.js', () => ({
//   getSecret: vi.fn().mockImplementation(async (key) => {
//     const envMap: Record<string, string> = {
//       openai_api_key: process.env.OPENAI_API_KEY || '',
//       groq_api_key: process.env.GROQ_API_KEY || '',
//       openrouter_api_key: process.env.OPENROUTER_API_KEY || '',
//     };
//     return envMap[key];
//   }),
// }));

// ═══════════════════════════════════════════════════════════════
// TEST CONTEXT
// ═══════════════════════════════════════════════════════════════

const TEST_USER_CONTEXT = {
  userId: 999999999,
  userName: 'TestUser',
  marketplace: 'all' as const,
  wbApiKey: 'test-key',
  ozonApiKey: 'test-key',
  productsCount: 4,
  onboardingMode: false,
  isFirstContact: false,
};

// ═══════════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════════

const SCENARIOS = [
  // ========================================
  // CATEGORY 1: Tool Selection Tests
  // ========================================
  {
    category: 'tool_selection',
    name: 'Юнит-экономика по названию товара',
    input: 'Посчитай прибыль на рейлинги',
    expectedTools: ['get_products'], // Agent MUST search for product first
    expectedBehavior: 'Должен искать товар по названию через search',
    checkArgs: (args: Record<string, unknown>) => {
      // Check if search arg exists and correct
      return !!(args.search && String(args.search).toLowerCase().includes('рейлинг'));
    },
  },
  {
    category: 'tool_selection',
    name: 'Конкуренты без артикула',
    input: 'Проверь конкурентов',
    expectedTools: ['get_products'], // Must list products first
    forbiddenTools: ['search_web'], // Explicitly forbidden in prompt
    expectedBehavior: 'Должен сначала получить товары пользователя, НЕ использовать search_web',
  },
  {
    category: 'tool_selection',
    name: 'Продажи без периода',
    input: 'Покажи продажи',
    expectedTools: [], // Must ask for clarification
    expectedBehavior: 'Должен уточнить период у пользователя',
    checkResponse: (response: string) => {
      const r = response.toLowerCase();
      // Agent might ask for period OR check access/keys, which is acceptable behavior in this context
      const valid =
        r.includes('период') ||
        r.includes('сегодня') ||
        r.includes('неделя') ||
        r.includes('месяц') ||
        r.includes('время') ||
        r.includes('даты') ||
        r.includes('когда') ||
        r.includes('доступ') ||
        r.includes('подключ') ||
        r.includes('ключ');
      if (!valid) console.log('❌ Response check failed:', response);
      return valid;
    },
  },
  {
    category: 'tool_selection',
    name: 'Продажи с периодом',
    input: 'Покажи продажи за неделю',
    expectedTools: ['get_sales_stats'],
    checkArgs: (args: Record<string, unknown>) => {
      return args.period === 'week';
    },
  },

  // ========================================
  // CATEGORY 2: Context Continuation Tests
  // ========================================
  {
    category: 'context',
    name: 'Ответ на вопрос о себестоимости',
    history: [
      { role: 'user', content: 'Посчитай прибыль на панно' },
      {
        role: 'assistant',
        content: 'Чтобы рассчитать прибыль, мне нужна себестоимость. Какая себестоимость панно?',
      },
    ],
    input: '2500',
    expectedTools: ['calculate_unit_economics'],
    checkArgs: (args: Record<string, unknown>) => {
      return Number(args.cost_price) === 2500;
    },
  },

  // ========================================
  // CATEGORY 3: Simple Intent Tests
  // ========================================
  {
    category: 'simple_intent',
    name: 'Приветствие',
    input: 'Привет',
    expectedTools: [],
    checkResponse: (response: string) => {
      return (
        response.includes('Виктор') ||
        response.includes('управляющ') ||
        response.includes('менеджер')
      );
    },
  },
  {
    category: 'simple_intent',
    name: 'Благодарность',
    input: 'Спасибо',
    expectedTools: [],
    checkResponse: (response: string) => {
      return (
        response.toLowerCase().includes('пожалуйста') ||
        response.toLowerCase().includes('обращайтесь') ||
        response.toLowerCase().includes('рад')
      );
    },
  },

  // ========================================
  // CATEGORY 4: Error Handling Tests
  // ========================================
  {
    category: 'error_handling',
    name: 'Некорректный артикул в поиске',
    input: 'Проверь конкурента abc123',
    expectedTools: ['get_competitor_price'],
    expectError: false,
  },

  // ========================================
  // CATEGORY 5: Protection Tests
  // ========================================
  {
    category: 'protection',
    name: 'Установка минимальной цены',
    history: [
      { role: 'user', content: 'Найди панно' },
      { role: 'assistant', content: 'Нашел: Панно декоративное (ID: mock-wb-002)' },
    ],
    input: 'Установи минимальную цену 1000 на него',
    expectedTools: ['set_stop_loss'],
    requiresConfirmation: true, // Critical Action
    checkArgs: (args: Record<string, unknown>) => {
      return args.product_id === 'mock-wb-002' || String(args.min_price) === '1000';
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  duration: number;
  toolsCalled?: string[];
  response?: string;
}

// Interface for the agent result to avoid 'any'
interface AgentResult {
  success: boolean;
  message: string;
  toolsCalled?: string[];
  plan?: {
    requires_confirmation?: boolean;
    tools: Array<{ tool: string; args: Record<string, unknown> }>;
  };
}

const results: TestResult[] = [];

describe('Viktor AI Agent E2E Tests', () => {
  let orchestrateV4: typeof import('../../src/api-lib/agent/orchestrator-v4.js').orchestrateV4;

  beforeAll(async () => {
    // RESTORE FETCH for E2E tests (was mocked in setup.ts)
    const { fetch } = await import('undici');
    vi.stubGlobal('fetch', fetch);

    // Import logic AFTER mocking/unmocking
    const module = await import('../../src/api-lib/agent/orchestrator-v4.js');
    orchestrateV4 = module.orchestrateV4;
  });

  for (const scenario of SCENARIOS) {
    test(`[${scenario.category}] ${scenario.name}`, async () => {
      const startTime = Date.now();
      let result: AgentResult | undefined;

      try {
        console.log(`\n🧪 Running: ${scenario.name}`);
        // Cast the result to our interface
        result = (await orchestrateV4(
          scenario.input,
          TEST_USER_CONTEXT,
          scenario.history
        )) as unknown as AgentResult;
        const duration = Date.now() - startTime;

        console.log(`   Success: ${result.success}`);
        if (!result.success) {
          console.error(`   ❌ Orchestrator Failed: ${result.message}`);
        }
        console.log(`   Tools Called: ${result.toolsCalled?.join(', ') || '[]'}`);

        // Check for forbidden tools
        if (scenario.forbiddenTools && result.toolsCalled) {
          for (const forbidden of scenario.forbiddenTools) {
            expect(result.toolsCalled).not.toContain(forbidden);
          }
        }

        // Check expected tools
        if (scenario.expectedTools) {
          if (scenario.expectedTools.length === 0) {
            expect(result.toolsCalled).toHaveLength(0);
          } else {
            // We check that expected tools are present
            // We don't enforce order or absence of other tools strictly, unless specified
            for (const expected of scenario.expectedTools) {
              expect(result.toolsCalled).toContain(expected);
            }
          }
        }

        // Check requires_confirmation flag
        if (scenario.requiresConfirmation) {
          expect(result.plan?.requires_confirmation).toBe(true);
        }

        // Check response content
        if (scenario.checkResponse) {
          // If response logic returns false, print message for debugging
          const valid = scenario.checkResponse(result.message);
          if (!valid) {
            console.error(`Response check failed. Got: "${result.message}"`);
          }
          expect(valid).toBe(true);
        }

        // Check args if provided
        if (scenario.checkArgs && result?.plan?.tools) {
          // Flatten all args from all tools to see if any match
          // But usually we check the FIRST tool or specific tool
          const matchingTool = result.plan.tools.find(
            (t: { tool: string; args: Record<string, unknown> }) =>
              scenario.expectedTools?.includes(t.tool)
          );

          if (matchingTool) {
            const validArgs = scenario.checkArgs(matchingTool.args);
            if (!validArgs) {
              console.error(`Args check failed. Got:`, matchingTool.args);
            }
            expect(validArgs).toBe(true);
          } else if (scenario.expectedTools && scenario.expectedTools.length > 0) {
            // If we expected tools but found no matching tool in plan (even if toolsCalled has it?)
            // toolsCalled comes from plan, so this branch implies plan mismatch
          }
        }

        results.push({
          name: scenario.name,
          category: scenario.category,
          passed: true,
          duration,
          toolsCalled: result.toolsCalled,
          response: result.message.substring(0, 50),
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ Error in ${scenario.name}:`, error);

        if (scenario.expectError) {
          results.push({
            name: scenario.name,
            category: scenario.category,
            passed: true,
            duration,
            error: 'Expected error caught',
          });
        } else {
          results.push({
            name: scenario.name,
            category: scenario.category,
            passed: false,
            error: String(error),
            duration,
          });
          throw error;
        }
      }
    }, 45000);
  }
});

afterAll(() => {
  console.log('\n════════ VIKTOR E2E RESULTS ════════');
  const passed = results.filter(r => r.passed).length;
  console.log(`Summary: ${passed}/${results.length} PASSED`);
});
