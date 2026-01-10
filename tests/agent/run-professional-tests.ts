/**
 * 🧪 Viktor AI Agent Professional Test Runner
 *
 * Запуск:
 *   npx tsx tests/agent/run-professional-tests.ts
 *
 * Флаги:
 *   --setup    Создать тестовые данные
 *   --cleanup  Удалить тестовые данные
 *   --verbose  Подробный вывод
 *   --filter=  Фильтр по ID теста
 */

import 'dotenv/config';
import {
  setupTestUser,
  cleanupTestUser,
  PROFESSIONAL_SCENARIOS,
  TEST_USER_ID,
  TEST_USER_NAME,
  TEST_PRODUCTS,
  type TestScenario,
} from './fixtures/test-config.js';
import type { UserContext } from '../../src/api-lib/agent/orchestrator-v4.js';

// ═══════════════════════════════════════════════════════════════
// COLORS FOR TERMINAL
// ═══════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg: string) {
  console.log(msg);
}
function logSuccess(msg: string) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}
function logError(msg: string) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}
// logWarn/logInfo available if needed in future

// ═══════════════════════════════════════════════════════════════
// TEST RESULT TYPES
// ═══════════════════════════════════════════════════════════════

interface TestResult {
  id: string;
  name: string;
  category: string;
  priority: string;
  passed: boolean;
  duration: number;

  // Details
  toolsCalled: string[];
  responsePreview: string;

  // Failures
  failures: string[];

  // Debug
  planJson?: string;
}

// ═══════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════

async function runTests(options: {
  verbose?: boolean;
  filter?: string;
  skipSetup?: boolean;
}): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Import orchestrator
  const { orchestrateV4 } = await import('../../src/api-lib/agent/orchestrator-v4.js');

  // Build context for test user
  const testContext = {
    userId: TEST_USER_ID,
    userName: TEST_USER_NAME,
    marketplace: 'all' as const,
    productsCount: TEST_PRODUCTS.length,
    onboardingMode: false,
    isFirstContact: false,
  };

  // Filter scenarios if needed
  let scenarios = PROFESSIONAL_SCENARIOS;
  if (options.filter) {
    scenarios = scenarios.filter(
      s =>
        s.id.includes(options.filter!) ||
        s.name.toLowerCase().includes(options.filter!.toLowerCase())
    );
  }

  log('\n' + '═'.repeat(70));
  log(
    `${colors.bright}${colors.cyan}   🧪 VIKTOR AI AGENT — PROFESSIONAL E2E TESTS${colors.reset}`
  );
  log('═'.repeat(70));
  log(`\n📊 Running ${scenarios.length} scenarios for test user ${TEST_USER_ID}`);
  log(`🔒 DRY-RUN mode: Write operations are blocked\n`);

  // Run each scenario
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const progress = `[${i + 1}/${scenarios.length}]`;

    log(`\n${colors.gray}─────────────────────────────────────────────────────${colors.reset}`);
    log(`${progress} ${colors.bright}${scenario.id}${colors.reset}: ${scenario.name}`);
    log(
      `   ${colors.gray}Category: ${scenario.category} | Priority: ${scenario.priority}${colors.reset}`
    );

    const result = await runSingleScenario(scenario, testContext, orchestrateV4, options.verbose);
    results.push(result);

    if (result.passed) {
      logSuccess(`PASSED (${result.duration}ms)`);
    } else {
      logError(`FAILED (${result.duration}ms)`);
      for (const failure of result.failures) {
        log(`   ${colors.red}→ ${failure}${colors.reset}`);
      }
    }

    if (options.verbose) {
      log(`   ${colors.gray}Tools: ${result.toolsCalled.join(', ') || 'none'}${colors.reset}`);
      log(`   ${colors.gray}Response: ${result.responsePreview}${colors.reset}`);
    }
  }

  return results;
}

async function runSingleScenario(
  scenario: TestScenario,
  context: UserContext,
  orchestrateV4: typeof import('../../src/api-lib/agent/orchestrator-v4.js').orchestrateV4,
  verbose?: boolean
): Promise<TestResult> {
  const startTime = Date.now();
  const failures: string[] = [];

  try {
    // Call the agent
    const response = await orchestrateV4(scenario.input, context, scenario.history);

    const duration = Date.now() - startTime;
    const toolsCalled = response.toolsCalled || [];

    // ─── CHECK EXPECTED TOOLS ───────────────────────────────────
    if (scenario.expectedTools && scenario.expectedTools.length > 0) {
      for (const expected of scenario.expectedTools) {
        // Allow partial match (e.g., get_products OR get_abc_analysis)
        const found = toolsCalled.some((t: string) => t === expected);
        if (!found) {
          failures.push(
            `Expected tool '${expected}' was not called. Called: [${toolsCalled.join(', ')}]`
          );
        }
      }
    }

    // ─── CHECK FORBIDDEN TOOLS ──────────────────────────────────
    if (scenario.forbiddenTools) {
      for (const forbidden of scenario.forbiddenTools) {
        if (toolsCalled.includes(forbidden)) {
          failures.push(`Forbidden tool '${forbidden}' was called`);
        }
      }
    }

    // ─── CHECK REQUIRES CONFIRMATION ────────────────────────────
    if (scenario.requiresConfirmation) {
      if (!response.plan?.requires_confirmation) {
        failures.push('Expected requires_confirmation=true but got false');
      }
    }

    // ─── VALIDATE RESPONSE ──────────────────────────────────────
    if (scenario.validateResponse) {
      const validation = scenario.validateResponse(response.message);
      if (!validation.pass) {
        failures.push(`Response validation failed: ${validation.reason}`);
      }
    }

    // ─── VALIDATE PLAN ──────────────────────────────────────────
    if (scenario.validatePlan) {
      const validation = scenario.validatePlan(response.plan);
      if (!validation.pass) {
        failures.push(`Plan validation failed: ${validation.reason}`);
      }
    }

    // ─── VALIDATE TOOL ARGS ─────────────────────────────────────
    if (scenario.validateToolArgs && response.plan?.tools) {
      for (const tool of response.plan.tools) {
        const validation = scenario.validateToolArgs(tool.tool, tool.args || {});
        if (!validation.pass) {
          failures.push(`Tool args validation failed for '${tool.tool}': ${validation.reason}`);
        }
      }
    }

    return {
      id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      priority: scenario.priority,
      passed: failures.length === 0,
      duration,
      toolsCalled,
      responsePreview: response.message.substring(0, 100) + '...',
      failures,
      planJson: verbose ? JSON.stringify(response.plan, null, 2) : undefined,
    };
  } catch (error) {
    return {
      id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      priority: scenario.priority,
      passed: false,
      duration: Date.now() - startTime,
      toolsCalled: [],
      responsePreview: '',
      failures: [`Exception: ${error}`],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateReport(results: TestResult[]): void {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  log('\n\n' + '═'.repeat(70));
  log(`${colors.bright}${colors.cyan}   📊 TEST REPORT${colors.reset}`);
  log('═'.repeat(70));

  // Summary
  const passRate = Math.round((passed.length / results.length) * 100);
  const passColor = passRate >= 80 ? colors.green : passRate >= 50 ? colors.yellow : colors.red;

  log(`\n${colors.bright}Summary:${colors.reset}`);
  log(`   Total:    ${results.length} scenarios`);
  log(`   Passed:   ${colors.green}${passed.length}${colors.reset}`);
  log(`   Failed:   ${colors.red}${failed.length}${colors.reset}`);
  log(`   Rate:     ${passColor}${passRate}%${colors.reset}`);
  log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  // By Category
  log(`\n${colors.bright}By Category:${colors.reset}`);
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    const icon = catPassed === catResults.length ? '✅' : '⚠️';
    log(`   ${icon} ${cat}: ${catPassed}/${catResults.length}`);
  }

  // By Priority
  log(`\n${colors.bright}By Priority:${colors.reset}`);
  const priorities = ['critical', 'high', 'medium', 'low'];
  for (const pri of priorities) {
    const priResults = results.filter(r => r.priority === pri);
    if (priResults.length === 0) continue;
    const priPassed = priResults.filter(r => r.passed).length;
    const icon =
      priPassed === priResults.length
        ? '✅'
        : pri === 'critical' && priPassed < priResults.length
          ? '🔴'
          : '⚠️';
    log(`   ${icon} ${pri}: ${priPassed}/${priResults.length}`);
  }

  // Failed Tests Details
  if (failed.length > 0) {
    log(`\n${colors.bright}${colors.red}Failed Tests:${colors.reset}`);
    for (const f of failed) {
      log(`\n   ${colors.red}✗ ${f.id}: ${f.name}${colors.reset}`);
      for (const failure of f.failures) {
        log(`     ${colors.gray}→ ${failure}${colors.reset}`);
      }
      log(`     ${colors.gray}Response: ${f.responsePreview}${colors.reset}`);
    }
  }

  // Recommendations
  if (failed.length > 0) {
    log(`\n${colors.bright}${colors.yellow}Recommendations:${colors.reset}`);

    const criticalFailed = failed.filter(f => f.priority === 'critical');
    if (criticalFailed.length > 0) {
      log(`   🔴 ${criticalFailed.length} CRITICAL tests failed — fix before launch!`);
    }

    const toolSelectionFailed = failed.filter(f =>
      f.failures.some(fail => fail.includes('Expected tool'))
    );
    if (toolSelectionFailed.length > 0) {
      log(`   → Check PLANNER_PROMPT in src/api-lib/agent/prompts/system-v5.ts`);
    }

    const contextFailed = failed.filter(f => f.category === 'context');
    if (contextFailed.length > 0) {
      log(`   → Check КОНТЕКСТНЫЕ ОТВЕТЫ section in system-v5.ts`);
    }
  }

  // Final Verdict
  log('\n' + '═'.repeat(70));
  if (passRate >= 90) {
    log(`${colors.green}${colors.bright}   ✅ AGENT READY FOR PRODUCTION${colors.reset}`);
  } else if (passRate >= 70) {
    log(`${colors.yellow}${colors.bright}   ⚠️  AGENT NEEDS MINOR FIXES${colors.reset}`);
  } else {
    log(`${colors.red}${colors.bright}   ❌ AGENT NOT READY — SIGNIFICANT ISSUES${colors.reset}`);
  }
  log('═'.repeat(70) + '\n');
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const doSetup = args.includes('--setup');
  const doCleanup = args.includes('--cleanup');
  const filterArg = args.find(a => a.startsWith('--filter='));
  const filter = filterArg ? filterArg.split('=')[1] : undefined;

  try {
    // Setup if requested
    if (doSetup) {
      await setupTestUser();
      log('\n✅ Test data created. Run again without --setup to execute tests.\n');
      return;
    }

    // Cleanup if requested
    if (doCleanup) {
      await cleanupTestUser();
      log('\n✅ Test data cleaned up.\n');
      return;
    }

    // Check for API key
    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      logError('No LLM API key found! Set GROQ_API_KEY or OPENAI_API_KEY');
      process.exit(1);
    }

    // Setup test data
    await setupTestUser();

    // Run tests
    const results = await runTests({ verbose, filter });

    // Generate report
    generateReport(results);

    // Cleanup
    await cleanupTestUser();

    // Exit code
    const failed = results.filter(r => !r.passed).length;
    const criticalFailed = results.filter(r => !r.passed && r.priority === 'critical').length;

    if (criticalFailed > 0) {
      process.exit(2); // Critical failure
    } else if (failed > 0) {
      process.exit(1); // Some failures
    } else {
      process.exit(0); // All passed
    }
  } catch (error) {
    logError(`Fatal error: ${error}`);

    // Try to cleanup
    try {
      await cleanupTestUser();
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

main();
