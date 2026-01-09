/**
 * 🧪 Viktor AI Agent Test Suite
 *
 * Система автоматического тестирования агента:
 * - Логические ошибки
 * - Сломанные инструменты
 * - Контекстные ответы
 * - Регрессии
 *
 * Запуск: npx tsx tests/agent/viktor-e2e.test.ts
 */

import { describe, test, expect, beforeAll } from 'vitest';

// Mock user context
const TEST_USER = {
  userId: 999999999,
  userName: 'TestUser',
  marketplace: 'all' as const,
  wbApiKey: 'test-key',
  ozonApiKey: 'test-key',
  productsCount: 34,
};

// Test scenarios for Viktor
const SCENARIOS = [
  // ========================================
  // CATEGORY 1: Tool Selection Tests
  // ========================================
  {
    category: 'tool_selection',
    name: 'Юнит-экономика по названию товара',
    input: 'Посчитай прибыль на рейлинги',
    expectedTools: ['get_products'],
    expectedBehavior: 'Должен искать товар по названию через search',
    checkArgs: (args: Record<string, unknown>) => {
      return args.search && String(args.search).toLowerCase().includes('рейлинг');
    },
  },
  {
    category: 'tool_selection',
    name: 'Конкуренты без артикула',
    input: 'Проверь конкурентов',
    expectedTools: ['get_products'],
    forbiddenTools: ['search_web'],
    expectedBehavior: 'Должен сначала получить товары пользователя, НЕ использовать search_web',
  },
  {
    category: 'tool_selection',
    name: 'Продажи без периода',
    input: 'Покажи продажи',
    expectedTools: [], // Должен СПРОСИТЬ период, не вызывать инструмент
    expectedBehavior: 'Должен уточнить период у пользователя',
    checkResponse: (response: string) => {
      return (
        response.toLowerCase().includes('период') ||
        response.toLowerCase().includes('сегодня') ||
        response.toLowerCase().includes('неделя')
      );
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
      return args.cost_price === 2500;
    },
  },
  {
    category: 'context',
    name: 'Ответ на вопрос о периоде',
    history: [
      { role: 'user', content: 'Покажи продажи' },
      { role: 'assistant', content: 'За какой период показать? Сегодня, неделя, месяц?' },
    ],
    input: 'за месяц',
    expectedTools: ['get_sales_stats'],
    checkArgs: (args: Record<string, unknown>) => {
      return args.period === 'month';
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
      return response.includes('Виктор') && response.includes('управляющ');
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
        response.toLowerCase().includes('обращайтесь')
      );
    },
  },

  // ========================================
  // CATEGORY 4: Error Handling Tests
  // ========================================
  {
    category: 'error_handling',
    name: 'Некорректный артикул',
    input: 'Проверь конкурента abc123',
    expectedTools: ['get_competitor_price'],
    expectError: true,
  },
  {
    category: 'error_handling',
    name: 'Несуществующий товар',
    input: 'Установи минималку на qwerty12345',
    expectedBehavior: 'Должен сообщить что товар не найден',
  },

  // ========================================
  // CATEGORY 5: Protection Tests
  // ========================================
  {
    category: 'protection',
    name: 'Установка минимальной цены',
    input: 'Установи минимальную цену 1000 на панно',
    expectedTools: ['set_stop_loss'],
    requiresConfirmation: true,
  },
  {
    category: 'protection',
    name: 'Массовая защита',
    input: 'Защити все товары на 10%',
    expectedTools: ['bulk_protect_products'],
    requiresConfirmation: true,
  },
];

// Test results tracking
interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  duration: number;
  toolsCalled?: string[];
  response?: string;
}

const results: TestResult[] = [];

describe('Viktor AI Agent E2E Tests', () => {
  // Run each scenario
  for (const scenario of SCENARIOS) {
    test(`[${scenario.category}] ${scenario.name}`, async () => {
      const startTime = Date.now();

      try {
        // Import orchestrator dynamically to avoid module issues in test
        const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4.js');

        // Call the agent
        const result = await orchestrateV4(scenario.input, TEST_USER, scenario.history);

        const duration = Date.now() - startTime;

        // Check for forbidden tools
        if (scenario.forbiddenTools) {
          for (const forbidden of scenario.forbiddenTools) {
            expect(result.toolsCalled).not.toContain(forbidden);
          }
        }

        // Check expected tools
        if (scenario.expectedTools && scenario.expectedTools.length > 0) {
          for (const expected of scenario.expectedTools) {
            expect(result.toolsCalled).toContain(expected);
          }
        }

        // Check requires_confirmation flag
        if (scenario.requiresConfirmation) {
          expect(result.plan?.requires_confirmation).toBe(true);
        }

        // Check response content
        if (scenario.checkResponse) {
          expect(scenario.checkResponse(result.message)).toBe(true);
        }

        // Check args if provided
        if (scenario.checkArgs && result.plan?.tools?.[0]?.args) {
          expect(scenario.checkArgs(result.plan.tools[0].args)).toBe(true);
        }

        results.push({
          name: scenario.name,
          category: scenario.category,
          passed: true,
          duration,
          toolsCalled: result.toolsCalled,
          response: result.message.substring(0, 100),
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        if (scenario.expectError) {
          // Expected error - test passes
          results.push({
            name: scenario.name,
            category: scenario.category,
            passed: true,
            duration,
            error: 'Expected error occurred',
          });
        } else {
          // Unexpected error - test fails
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
    }, 30000); // 30s timeout for LLM calls
  }
});

// After all tests, print summary
afterAll(() => {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                   VIKTOR AI AGENT TEST REPORT                  ');
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📊 Summary: ${passed}/${results.length} passed (${failed} failed)`);
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];

  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;

    console.log(`\n📁 ${cat}: ${catPassed}/${catResults.length}`);

    for (const r of catResults) {
      const icon = r.passed ? '✅' : '❌';
      const time = `(${r.duration}ms)`;
      console.log(`   ${icon} ${r.name} ${time}`);

      if (!r.passed && r.error) {
        console.log(`      Error: ${r.error.substring(0, 100)}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');

  // Recommendations
  if (failed > 0) {
    console.log('\n🔧 Рекомендации по исправлению:');

    const failedTests = results.filter(r => !r.passed);
    for (const r of failedTests) {
      console.log(`\n❌ ${r.name}:`);
      console.log(`   Ошибка: ${r.error}`);
      console.log(`   Категория: ${r.category}`);

      // Specific recommendations
      if (r.category === 'tool_selection') {
        console.log('   → Проверьте промпт планировщика в system-v5.ts');
      } else if (r.category === 'context') {
        console.log('   → Проверьте секцию КОНТЕКСТНЫЕ ОТВЕТЫ в промпте');
      } else if (r.category === 'error_handling') {
        console.log('   → Проверьте обработку ошибок в tool-executors.ts');
      }
    }
  }
});

// Utility function for running single scenario manually
export async function testScenario(scenarioName: string) {
  const scenario = SCENARIOS.find(s => s.name === scenarioName);
  if (!scenario) {
    console.error(`Scenario "${scenarioName}" not found`);
    return;
  }

  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`   Input: "${scenario.input}"`);
  console.log(`   Expected tools: ${scenario.expectedTools?.join(', ') || 'none'}`);

  try {
    const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4.js');

    const result = await orchestrateV4(scenario.input, TEST_USER, scenario.history);

    console.log(`\n   ✅ Response: ${result.message.substring(0, 200)}...`);
    console.log(`   🔧 Tools called: ${result.toolsCalled?.join(', ') || 'none'}`);
    console.log(`   ⏱️  Time: ${result.totalTimeMs}ms`);

    return result;
  } catch (error) {
    console.error(`\n   ❌ Error: ${error}`);
    throw error;
  }
}
