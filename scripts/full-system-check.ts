/**
 * NeuroGUARDIAN — Full System Health Check
 * Проверяет ВСЕ ключевые компоненты системы
 */
import 'dotenv/config';

console.log('🚀 NeuroGUARDIAN — ПОЛНАЯ ДИАГНОСТИКА СИСТЕМЫ');
console.log('═'.repeat(60));

const results: { component: string; status: 'OK' | 'WARN' | 'FAIL'; details: string }[] = [];

async function check(name: string, fn: () => Promise<{ ok: boolean; info: string }>) {
  try {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    results.push({
      component: name,
      status: result.ok ? 'OK' : 'WARN',
      details: `${result.info} (${duration}ms)`,
    });

    console.log(`${result.ok ? '✅' : '⚠️'} ${name}: ${result.info} (${duration}ms)`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    results.push({ component: name, status: 'FAIL', details: msg });
    console.log(`❌ ${name}: FAILED - ${msg}`);
  }
}

async function main() {
  // 1. Database Connection
  console.log('\n📦 DATABASE');
  await check('PostgreSQL Connection', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT version()`;
    return { ok: true, info: `Connected (PG ${res.rows[0].version.slice(0, 30)}...)` };
  });

  await check('Users Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM users`;
    return { ok: true, info: `${res.rows[0].count} users` };
  });

  await check('Products Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM products`;
    return { ok: true, info: `${res.rows[0].count} products` };
  });

  await check('Sentinel Logs Table', async () => {
    const { sql } = await import('../src/api-lib/services/database.js');
    const res = await sql`SELECT count(*) FROM sentinel_logs`;
    return { ok: true, info: `${res.rows[0].count} logs` };
  });

  // 2. Core Modules
  console.log('\n🧠 CORE MODULES');
  await check('Tool Registry', async () => {
    const { registerAllTools, toolRegistry } = await import('../src/agent/execution/index.js');
    registerAllTools();
    const stats = toolRegistry.getStats();
    return { ok: stats.total > 15, info: `${stats.total} tools registered` };
  });

  await check('Knowledge Base', async () => {
    const { knowledgeBase } = await import('../src/agent/core/KnowledgeBase.js');
    const docs = await knowledgeBase.search('WB API', 1);
    return { ok: true, info: `${docs.length} docs found for test query` };
  });

  await check('State Manager', async () => {
    const { stateManager } = await import('../src/agent/core/StateManager.js');
    // Just check it imports
    return { ok: !!stateManager, info: 'Module loaded' };
  });

  await check('Prompt Builder', async () => {
    const { promptBuilder } = await import('../src/agent/core/PromptBuilder.js');
    return { ok: !!promptBuilder, info: 'Module loaded' };
  });

  // 3. Services
  console.log('\n🔧 SERVICES');
  await check('Sentinel Orchestrator', async () => {
    const { sentinelOrchestrator } = await import('../src/sentinel/SentinelOrchestrator.js');
    return { ok: !!sentinelOrchestrator, info: 'Ready' };
  });

  await check('ThreatDetector', async () => {
    const { ThreatDetector } = await import('../src/sentinel/ThreatDetector.js');
    const detector = new ThreatDetector();
    return { ok: !!detector, info: 'Ready' };
  });

  await check('AdvancedThreatDetector (ML-Lite)', async () => {
    const { advancedThreatDetector } = await import('../src/sentinel/AdvancedThreatDetector.js');
    return { ok: !!advancedThreatDetector, info: 'Ready (Phase 2)' };
  });

  await check('SmartDefaultsService', async () => {
    const { smartDefaultsService } =
      await import('../src/api-lib/core-services/SmartDefaultsService.js');
    return { ok: !!smartDefaultsService, info: 'Ready (Phase 1)' };
  });

  await check('MarketplaceService', async () => {
    const { marketplaceService } =
      await import('../src/api-lib/core-services/MarketplaceService.js');
    return { ok: !!marketplaceService, info: 'Ready' };
  });

  await check('NotificationService', async () => {
    const { notificationService } = await import('../src/api-lib/services/notifications.js');
    return { ok: !!notificationService, info: 'Ready' };
  });

  // 4. Environment Variables
  console.log('\n🔐 ENVIRONMENT');
  const envChecks = [
    ['POSTGRES_URL', !!process.env.POSTGRES_URL],
    ['GROQ_API_KEY', !!process.env.GROQ_API_KEY],
    ['TELEGRAM_BOT_TOKEN', !!process.env.TELEGRAM_BOT_TOKEN],
    ['ADMIN_TELEGRAM_ID', !!process.env.ADMIN_TELEGRAM_ID],
    ['ENCRYPTION_KEY', !!process.env.ENCRYPTION_KEY],
  ];

  for (const [name, ok] of envChecks) {
    results.push({
      component: `ENV: ${name}`,
      status: ok ? 'OK' : 'WARN',
      details: ok ? 'Set' : 'MISSING',
    });
    console.log(`${ok ? '✅' : '⚠️'} ${name}: ${ok ? 'Set' : 'MISSING'}`);
  }

  // 5. API Endpoints (local simulation)
  console.log('\n🌐 API READINESS');
  await check('API Handler Import', async () => {
    const { default: handler } = await import('../api/index.js');
    return { ok: typeof handler === 'function', info: 'Handler function ready' };
  });

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');

  const okCount = results.filter(r => r.status === 'OK').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`✅ OK: ${okCount} | ⚠️ WARN: ${warnCount} | ❌ FAIL: ${failCount}`);

  if (failCount === 0 && warnCount === 0) {
    console.log('\n🎉 СИСТЕМА ГОТОВА К БОЮ! ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!');
  } else if (failCount === 0) {
    console.log('\n⚡ СИСТЕМА ЧАСТИЧНО ГОТОВА. Некритичные предупреждения.');
  } else {
    console.log('\n🛑 ЕСТЬ КРИТИЧЕСКИЕ ОШИБКИ! Необходимо исправить перед деплоем.');
  }

  // Show failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\n❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ:');
    for (const f of failures) {
      console.log(`   - ${f.component}: ${f.details}`);
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 DIAGNOSTIC CRASHED:', err);
  process.exit(1);
});
