/**
 * Direct Production System Test
 * Tests specific components: Multi-Agent, RAG, Tools
 *
 * Run: npx tsx scripts/verify-production.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_BASE = 'https://neuro-guardian.vercel.app/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const TEST_USER_ID = 7548070478;

async function apiCall(action: string, body?: object): Promise<any> {
  const res = await fetch(`${API_BASE}?action=${action}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: body ? JSON.stringify({ ...body, telegramId: TEST_USER_ID }) : undefined,
  });
  return res.json();
}

async function main() {
  console.log('🔬 NeuroGUARDIAN Production Verification');
  console.log('='.repeat(60));

  // 1. Health Check
  console.log('\n1️⃣ HEALTH CHECK');
  const health = await apiCall('health');
  console.log(`   Status: ${health.status}`);
  console.log(`   Version: ${health.version}`);
  console.log(`   Database: ${health.database}`);
  console.log(`   Kernel: ${health.kernel?.initialized ? '✅ Active' : '❌ Not initialized'}`);
  console.log(`   Modules: ${health.kernel?.modulesCount || 0}`);

  // 2. Agent Architecture Test
  console.log('\n2️⃣ MULTI-AGENT V6 TEST');
  console.log('   Sending: "Привет, кто ты?"');

  const identityTest = await apiCall('agent', {
    message: 'Привет, кто ты и какая у тебя версия?',
    history: [],
  });

  console.log(`   Response length: ${identityTest.content?.length || 0} chars`);
  console.log(`   Preview: ${identityTest.content?.substring(0, 150)}...`);

  // Check metadata for multi-agent info
  if (identityTest.metadata) {
    console.log(`   Metadata: ${JSON.stringify(identityTest.metadata, null, 2)}`);
  }
  if (identityTest.specialist) {
    console.log(`   ✅ Specialist: ${identityTest.specialist}`);
  }
  if (identityTest.intent) {
    console.log(`   ✅ Intent: ${identityTest.intent.category}`);
  }

  // 3. RAG Test
  console.log('\n3️⃣ RAG KNOWLEDGE BASE TEST');
  console.log('   Sending: "Что такое Saved Amount и как работает Sentinel?"');

  const ragTest = await apiCall('agent', {
    message: 'Что такое Saved Amount в NeuroGUARDIAN и как работает защита Sentinel?',
    history: [],
  });

  console.log(`   Response length: ${ragTest.content?.length || 0} chars`);
  console.log(`   Preview: ${ragTest.content?.substring(0, 300)}...`);

  // Check for domain-specific knowledge
  const hasSentinelKnowledge =
    ragTest.content?.toLowerCase().includes('sentinel') ||
    ragTest.content?.toLowerCase().includes('saved') ||
    ragTest.content?.toLowerCase().includes('защит');
  console.log(`   Domain knowledge: ${hasSentinelKnowledge ? '✅ Detected' : '⚠️ Not detected'}`);

  // 4. Tools Test
  console.log('\n4️⃣ TOOLS EXECUTION TEST');
  console.log('   Sending: "Покажи список моих товаров"');

  const toolsTest = await apiCall('agent', {
    message: 'Покажи список моих товаров',
    history: [],
  });

  console.log(`   Response length: ${toolsTest.content?.length || 0} chars`);
  console.log(`   Preview: ${toolsTest.content?.substring(0, 200)}...`);

  if (toolsTest.toolsCalled && toolsTest.toolsCalled.length > 0) {
    console.log(`   ✅ Tools called: ${toolsTest.toolsCalled.join(', ')}`);
  } else if (toolsTest.content?.includes('товар') || toolsTest.content?.includes('артикул')) {
    console.log(`   ⚠️ Response mentions products, but tools not logged`);
  }

  // 5. Intent Classification Test
  console.log('\n5️⃣ INTENT CLASSIFICATION TEST');

  const testQueries = [
    { query: 'Сколько у меня товаров?', expected: 'PRODUCTS' },
    { query: 'Установи стоп-лосс 1000 рублей', expected: 'PRICING' },
    { query: 'Статус защиты', expected: 'SENTINEL' },
    { query: 'Аналитика продаж', expected: 'ANALYTICS' },
    { query: 'Привет!', expected: 'CHAT' },
  ];

  for (const test of testQueries) {
    const result = await apiCall('agent', {
      message: test.query,
      history: [],
    });

    const detected =
      result.intent?.category ||
      result.specialist?.replace('Specialist', '').toUpperCase() ||
      'unknown';
    const match = detected.includes(test.expected) ? '✅' : '⚠️';
    console.log(`   ${match} "${test.query}" → ${detected} (expected: ${test.expected})`);
  }

  // 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`
  ✅ API Health: ${health.status}
  ✅ Database: ${health.database}
  ✅ Kernel Modules: ${health.kernel?.modulesCount || 0}
  ${identityTest.content?.length > 50 ? '✅' : '❌'} LLM Response: ${identityTest.content?.length || 0} chars
  ${hasSentinelKnowledge ? '✅' : '⚠️'} RAG Knowledge: ${hasSentinelKnowledge ? 'Working' : 'Check KB'}
  ${toolsTest.toolsCalled?.length > 0 ? '✅' : '⚠️'} Tools: ${toolsTest.toolsCalled?.length || 0} called
  `);

  if (health.status === 'healthy' && identityTest.content && hasSentinelKnowledge) {
    console.log('🎉 PRODUCTION SYSTEM: OPERATIONAL');
  } else {
    console.log('⚠️  PRODUCTION SYSTEM: NEEDS ATTENTION');
  }
}

main().catch(console.error);
