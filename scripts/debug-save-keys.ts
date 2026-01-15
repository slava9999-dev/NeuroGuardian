/**
 * Complete diagnostic for marketplace accounts API
 * Simulates exact frontend flow
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_BASE = 'https://neuro-guardian.vercel.app/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const TEST_USER_ID = 7548070478;

interface DiagResult {
  step: string;
  success: boolean;
  statusCode?: number;
  data?: unknown;
  error?: string;
}

async function diagnose(): Promise<void> {
  const results: DiagResult[] = [];

  console.log('🔬 Starting marketplace accounts diagnostic...\n');
  console.log('='.repeat(60));

  // 1. GET accounts
  console.log('\n📋 Step 1: GET existing accounts');
  try {
    const res = await fetch(`${API_BASE}?action=marketplace-accounts&telegramId=${TEST_USER_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
    });
    const data = await res.json();
    results.push({
      step: 'GET accounts',
      success: data.success === true,
      statusCode: res.status,
      data,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Accounts count: ${data.accounts?.length ?? 0}`);
    if (data.accounts?.length) {
      console.log(`   Latest account: ${JSON.stringify(data.accounts[0], null, 2)}`);
    }
  } catch (e) {
    results.push({ step: 'GET accounts', success: false, error: String(e) });
    console.log(`   ❌ Error: ${e}`);
  }

  // 2. POST create WB account
  console.log('\n➕ Step 2: POST create WB account');
  try {
    const payload = {
      action: 'marketplace-accounts',
      telegramId: TEST_USER_ID,
      name: 'Диагностика WB ' + Date.now(),
      marketplace: 'wb',
      wbApiKey: 'test-wb-token-' + Date.now(),
      isActive: true,
    };
    console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

    const res = await fetch(`${API_BASE}?action=marketplace-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    results.push({
      step: 'POST create WB',
      success: data.success === true,
      statusCode: res.status,
      data,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (e) {
    results.push({ step: 'POST create WB', success: false, error: String(e) });
    console.log(`   ❌ Error: ${e}`);
  }

  // 3. POST create Ozon account
  console.log('\n➕ Step 3: POST create Ozon account');
  try {
    const payload = {
      action: 'marketplace-accounts',
      telegramId: TEST_USER_ID,
      name: 'Диагностика Ozon ' + Date.now(),
      marketplace: 'ozon',
      ozonClientId: 'client-' + Date.now(),
      ozonApiKey: 'apikey-' + Date.now(),
      isActive: true,
    };
    console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

    const res = await fetch(`${API_BASE}?action=marketplace-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    results.push({
      step: 'POST create Ozon',
      success: data.success === true,
      statusCode: res.status,
      data,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (e) {
    results.push({ step: 'POST create Ozon', success: false, error: String(e) });
    console.log(`   ❌ Error: ${e}`);
  }

  // 4. Test with empty keys (like frontend might send)
  console.log('\n⚠️ Step 4: POST with EMPTY keys (simulating frontend bug)');
  try {
    const payload = {
      action: 'marketplace-accounts',
      telegramId: TEST_USER_ID,
      name: 'Пустые ключи ' + Date.now(),
      marketplace: 'wb',
      wbApiKey: '', // Empty!
      isActive: true,
    };
    console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

    const res = await fetch(`${API_BASE}?action=marketplace-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    results.push({
      step: 'POST empty keys',
      success: data.success === true,
      statusCode: res.status,
      data,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (e) {
    results.push({ step: 'POST empty keys', success: false, error: String(e) });
    console.log(`   ❌ Error: ${e}`);
  }

  // 5. Final verification
  console.log('\n📋 Step 5: Final verification - GET all accounts');
  try {
    const res = await fetch(`${API_BASE}?action=marketplace-accounts&telegramId=${TEST_USER_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
    });
    const data = await res.json();
    results.push({
      step: 'Final GET',
      success: data.success === true,
      statusCode: res.status,
      data,
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Total accounts: ${data.accounts?.length ?? 0}`);

    if (data.accounts?.length) {
      console.log('\n   📦 All accounts:');
      data.accounts.forEach((acc: any, i: number) => {
        console.log(`   ${i + 1}. ${acc.name} (${acc.marketplace}) - ID: ${acc.id}`);
        console.log(`      WB Token: ${acc.wb_token || 'not set'}`);
        console.log(`      Ozon: ${acc.ozon_client_id || 'not set'}`);
      });
    }
  } catch (e) {
    results.push({ step: 'Final GET', success: false, error: String(e) });
    console.log(`   ❌ Error: ${e}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY:');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! API is working correctly.');
    console.log('   The issue is likely in the FRONTEND (Telegram WebApp auth or form handling).');
  } else {
    console.log('\n⚠️ Some tests failed. Details:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - ${r.step}: ${r.error || r.data}`);
      });
  }
}

diagnose().catch(console.error);
