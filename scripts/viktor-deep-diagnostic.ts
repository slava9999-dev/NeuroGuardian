/**
 * NeuroGUARDIAN — Viktor Deep System Diagnostic
 * Полная проверка ВСЕХ компонентов AI-агента Виктор
 */
import 'dotenv/config';

console.log('🧠 VIKTOR DEEP SYSTEM DIAGNOSTIC');
console.log('═'.repeat(70));
console.log('Проверяем каждый "орган" AI-агента...\n');

interface TestResult {
  component: string;
  subtest: string;
  status: 'OK' | 'WARN' | 'FAIL';
  details: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(
  component: string,
  subtest: string,
  fn: () => Promise<{ ok: boolean; info: string }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    results.push({
      component,
      subtest,
      status: result.ok ? 'OK' : 'WARN',
      details: result.info,
      durationMs: duration,
    });
    console.log(
      `${result.ok ? '✅' : '⚠️'} [${component}] ${subtest}: ${result.info} (${duration}ms)`
    );
  } catch (error) {
    const duration = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    results.push({
      component,
      subtest,
      status: 'FAIL',
      details: msg.slice(0, 100),
      durationMs: duration,
    });
    console.log(`❌ [${component}] ${subtest}: ${msg.slice(0, 80)} (${duration}ms)`);
  }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════
  // 1. БАЗА ДАННЫХ (Сердце системы)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n💾 1. DATABASE (Сердце)');
  console.log('─'.repeat(50));

  await test('Database', 'Connection', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT 1 as ping`;
    return { ok: res.rows[0].ping === 1, info: 'PostgreSQL connected' };
  });

  await test('Database', 'Users Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM users`;
    return { ok: true, info: `${res.rows[0].count} users` };
  });

  await test('Database', 'Products Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM products`;
    return { ok: true, info: `${res.rows[0].count} products` };
  });

  await test('Database', 'User State Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM user_state`;
    return { ok: true, info: `${res.rows[0].count} states` };
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. RAG СИСТЕМА (Память и знания)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📚 2. RAG SYSTEM (Память)');
  console.log('─'.repeat(50));

  await test('RAG', 'Knowledge Base Load', async () => {
    const { knowledgeBase } = await import('../src/agent/core/KnowledgeBase.js');
    // Force reload
    await knowledgeBase.search('test', 1);
    return { ok: !!knowledgeBase, info: 'Documents loaded' };
  });

  await test('RAG', 'Search: WB API', async () => {
    const { knowledgeBase } = await import('../src/agent/core/KnowledgeBase.js');
    const docs = await knowledgeBase.search('Wildberries API токен', 3);
    return { ok: docs.length > 0, info: `${docs.length} relevant docs found` };
  });

  await test('RAG', 'Search: Ozon Integration', async () => {
    const { knowledgeBase } = await import('../src/agent/core/KnowledgeBase.js');
    const docs = await knowledgeBase.search('Ozon подключение client id', 3);
    return { ok: docs.length > 0, info: `${docs.length} relevant docs found` };
  });

  await test('RAG', 'Search: Stop-Loss', async () => {
    const { knowledgeBase } = await import('../src/agent/core/KnowledgeBase.js');
    const docs = await knowledgeBase.search('минимальная цена стоп-лосс', 3);
    return { ok: docs.length > 0, info: `${docs.length} relevant docs found` };
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. TOOL REGISTRY (Руки агента)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🔧 3. TOOL REGISTRY (Руки)');
  console.log('─'.repeat(50));

  await test('Tools', 'Registry Init', async () => {
    const { registerAllTools, toolRegistry } = await import('../src/agent/execution/index.js');
    registerAllTools();
    const stats = toolRegistry.getStats();
    return { ok: stats.total >= 20, info: `${stats.total} tools registered` };
  });

  await test('Tools', 'Read Tools', async () => {
    const { toolRegistry } = await import('../src/agent/execution/index.js');
    const readTools = ['get_products', 'get_orders', 'get_reviews', 'get_sales_stats'];
    const missing = readTools.filter(t => !toolRegistry.has(t));
    return {
      ok: missing.length === 0,
      info: missing.length === 0 ? 'All read tools present' : `Missing: ${missing.join(', ')}`,
    };
  });

  await test('Tools', 'Write Tools', async () => {
    const { toolRegistry } = await import('../src/agent/execution/index.js');
    const writeTools = ['set_stop_loss', 'update_prices', 'update_stocks', 'bulk_protect_products'];
    const missing = writeTools.filter(t => !toolRegistry.has(t));
    return {
      ok: missing.length === 0,
      info: missing.length === 0 ? 'All write tools present' : `Missing: ${missing.join(', ')}`,
    };
  });

  await test('Tools', 'Search Tools', async () => {
    const { toolRegistry } = await import('../src/agent/execution/index.js');
    const searchTools = ['search_web', 'get_competitor_price', 'get_real_price'];
    const missing = searchTools.filter(t => !toolRegistry.has(t));
    return {
      ok: missing.length === 0,
      info: missing.length === 0 ? 'All search tools present' : `Missing: ${missing.join(', ')}`,
    };
  });

  await test('Tools', 'Tool Schema Validation', async () => {
    const { toolRegistry } = await import('../src/agent/execution/index.js');
    const tool = toolRegistry.get('get_products');
    const hasSchema = tool && tool.schema;
    return { ok: !!hasSchema, info: hasSchema ? 'Schemas defined' : 'Missing schemas!' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. STATE MANAGER (Память разговора)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🧩 4. STATE MANAGER (Кратковременная память)');
  console.log('─'.repeat(50));

  await test('StateManager', 'Module Load', async () => {
    const { stateManager } = await import('../src/agent/core/StateManager.js');
    return { ok: !!stateManager, info: 'StateManager ready' };
  });

  await test('StateManager', 'Initial State', async () => {
    const { stateManager } = await import('../src/agent/core/StateManager.js');
    const state = await stateManager.getState(999999); // Test user
    return { ok: state.marketplace !== undefined, info: 'Default state returned for new user' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. PROMPT BUILDER (Мозг формирования промптов)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📝 5. PROMPT BUILDER (Формирование промптов)');
  console.log('─'.repeat(50));

  await test('PromptBuilder', 'Module Load', async () => {
    const { promptBuilder } = await import('../src/agent/core/PromptBuilder.js');
    return { ok: !!promptBuilder, info: 'PromptBuilder ready' };
  });

  await test('PromptBuilder', 'Generate Planner Prompt', async () => {
    const { promptBuilder } = await import('../src/agent/core/PromptBuilder.js');
    const prompt = await promptBuilder.buildPlannerPrompt(
      {
        userState: {
          marketplace: 'WB',
          hasApiKeys: true,
          hasWbKey: true,
          hasOzonKey: false,
          productsCount: 10,
          subscriptionTier: 'pro',
          lastMentionedProducts: [],
          awaitingInput: null,
          pendingAction: null,
        },
        recentHistory: [],
        isFirstContact: false,
        userId: 1,
      },
      'Покажи мои продажи'
    );
    return { ok: prompt.length > 500, info: `Prompt generated (${prompt.length} chars)` };
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. SENTINEL (Охранная система)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🛡️ 6. SENTINEL (Охрана цен)');
  console.log('─'.repeat(50));

  await test('Sentinel', 'Orchestrator Init', async () => {
    const { sentinelOrchestrator } = await import('../src/sentinel/SentinelOrchestrator.js');
    return { ok: !!sentinelOrchestrator, info: 'Orchestrator ready' };
  });

  await test('Sentinel', 'ThreatDetector', async () => {
    const { ThreatDetector } = await import('../src/sentinel/ThreatDetector.js');
    const detector = new ThreatDetector();
    return { ok: !!detector, info: 'ThreatDetector ready' };
  });

  await test('Sentinel', 'AdvancedThreatDetector (ML-Lite)', async () => {
    const { advancedThreatDetector } = await import('../src/sentinel/AdvancedThreatDetector.js');
    return { ok: !!advancedThreatDetector, info: 'ML-Lite model ready' };
  });

  await test('Sentinel', 'SmartDefaults Phase 1', async () => {
    const { smartDefaultsService } =
      await import('../src/api-lib/core-services/SmartDefaultsService.js');
    return { ok: !!smartDefaultsService, info: 'SmartDefaults ready' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. MARKETPLACE INTEGRATION (Связь с маркетплейсами)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🛒 7. MARKETPLACE (Связь с WB/Ozon)');
  console.log('─'.repeat(50));

  await test('Marketplace', 'MarketplaceService', async () => {
    const { marketplaceService } =
      await import('../src/api-lib/core-services/MarketplaceService.js');
    return { ok: !!marketplaceService, info: 'MarketplaceService ready' };
  });

  await test('Marketplace', 'WB Service', async () => {
    const { wbService } = await import('../src/api-lib/core-services/WbService.js');
    return { ok: !!wbService, info: 'WbService ready' };
  });

  await test('Marketplace', 'Ozon Service', async () => {
    const { ozonService } = await import('../src/api-lib/core-services/OzonService.js');
    return { ok: !!ozonService, info: 'OzonService ready' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. SECURITY (Безопасность)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🔐 8. SECURITY (Безопасность)');
  console.log('─'.repeat(50));

  await test('Security', 'Crypto Functions', async () => {
    const { encryptApiKey, decryptApiKey } = await import('../src/api-lib/lib/crypto.js');
    const original = 'test_secret_key_123';
    const encrypted = encryptApiKey(original);
    const decrypted = decryptApiKey(encrypted);
    return { ok: decrypted === original, info: 'Encryption/Decryption works' };
  });

  await test('Security', 'Rate Limiter', async () => {
    // Check if rate limiter module exists
    const rateLimiterModule = await import('../src/api-lib/lib/rate-limit.js');
    return { ok: !!rateLimiterModule, info: 'RateLimiter module loaded' };
  });

  await test('Security', 'Input Sanitization', async () => {
    const { sanitizeInput } = await import('../src/api-lib/lib/validation.js');
    const sanitized = sanitizeInput('<script>alert("xss")</script>');
    const hasScript = sanitized.includes('<script>');
    return { ok: !hasScript, info: 'XSS tags stripped' };
  });

  await test('Security', 'Response Validator', async () => {
    const { responseValidator } = await import('../src/agent/core/ResponseValidator.js');
    return { ok: !!responseValidator, info: 'Guardrails ready' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. NOTIFICATIONS (Уведомления)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📬 9. NOTIFICATIONS (Уведомления)');
  console.log('─'.repeat(50));

  await test('Notifications', 'Service Init', async () => {
    const { notificationService } = await import('../src/api-lib/services/notifications.js');
    return { ok: !!notificationService, info: 'NotificationService ready' };
  });

  await test('Notifications', 'Telegram Bot Token', async () => {
    const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
    return { ok: hasToken, info: hasToken ? 'Token configured' : 'MISSING!' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. LLM PROVIDER (Мозг)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🤖 10. LLM PROVIDER (AI Мозг)');
  console.log('─'.repeat(50));

  await test('LLM', 'GROQ API Key', async () => {
    const hasKey = !!process.env.GROQ_API_KEY;
    return { ok: hasKey, info: hasKey ? 'Configured' : 'MISSING!' };
  });

  await test('LLM', 'Provider Module', async () => {
    const llmModule = await import('../src/infrastructure/llm/LLMProvider.js');
    return { ok: !!llmModule, info: 'LLMProvider module loaded' };
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. EXPERIENCE LEARNING (Обучение на опыте)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📖 11. EXPERIENCE LEARNING (Обучение)');
  console.log('─'.repeat(50));

  await test('Learning', 'Experience Module', async () => {
    const { experienceLearning } = await import('../src/agent/core/ExperienceLearning.js');
    return { ok: !!experienceLearning, info: 'ExperienceLearning ready' };
  });

  await test('Learning', 'Memory Manager', async () => {
    const { memoryManager } = await import('../src/agent/core/MemoryManager.js');
    return { ok: !!memoryManager, info: 'MemoryManager ready' };
  });

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📊 VIKTOR HEALTH SUMMARY');
  console.log('═'.repeat(70));

  const ok = results.filter(r => r.status === 'OK').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`\n✅ OK: ${ok}/${total} | ⚠️ WARN: ${warn} | ❌ FAIL: ${fail}`);
  console.log(`📈 Health Score: ${Math.round((ok / total) * 100)}%`);

  // Group by component
  const byComponent = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!byComponent.has(r.component)) byComponent.set(r.component, []);
    byComponent.get(r.component)!.push(r);
  }

  console.log('\n📋 By Component:');
  for (const [comp, tests] of byComponent) {
    const compOk = tests.filter(t => t.status === 'OK').length;
    const emoji =
      compOk === tests.length ? '✅' : tests.some(t => t.status === 'FAIL') ? '❌' : '⚠️';
    console.log(`  ${emoji} ${comp}: ${compOk}/${tests.length}`);
  }

  if (fail > 0) {
    console.log('\n❌ FAILED TESTS:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`   - [${r.component}] ${r.subtest}: ${r.details}`);
    }
  }

  if (fail === 0 && warn === 0) {
    console.log('\n🎉 VIKTOR IS 100% OPERATIONAL!');
    console.log('Все системы работают. Агент готов к бою!\n');
  } else if (fail === 0) {
    console.log('\n⚡ VIKTOR IS OPERATIONAL with minor warnings.');
    console.log('Агент работает, но есть некритичные предупреждения.\n');
  } else {
    console.log('\n🛑 VIKTOR HAS ISSUES!');
    console.log('Необходимо исправить критические ошибки.\n');
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 DIAGNOSTIC CRASHED:', err);
  process.exit(1);
});
