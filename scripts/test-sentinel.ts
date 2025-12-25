// ============================================
// NeuroGUARDIAN — Sentinel Test Script
// Manual test for stop-loss and Telegram notifications
// Run with: npx tsx scripts/test-sentinel.ts
// ============================================

const API_BASE = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api`
  : 'http://localhost:3000/api';

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'test-admin-key';

interface SentinelResponse {
  success: boolean;
  scanned: number;
  triggered: number;
  log: string[];
  debug_info?: unknown[];
}

async function testSentinel(): Promise<void> {
  console.log('🧪 NeuroGUARDIAN Sentinel Test');
  console.log('================================\n');

  // Step 1: Check current state
  console.log('📊 Step 1: Calling check-prices endpoint...\n');

  try {
    const response = await fetch(`${API_BASE}?action=check-prices&debug=true`, {
      method: 'GET',
      headers: {
        'X-Admin-Key': ADMIN_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data: SentinelResponse = await response.json();

    console.log('✅ Response received:');
    console.log(`   - Success: ${data.success}`);
    console.log(`   - Scanned: ${data.scanned} products`);
    console.log(`   - Triggered: ${data.triggered} stop-loss events`);
    console.log('');

    if (data.log && data.log.length > 0) {
      console.log('📝 Logs:');
      for (const logLine of data.log.slice(-20)) {
        console.log(`   ${logLine}`);
      }
    }

    if (data.triggered > 0) {
      console.log('\n🚨 STOP-LOSS TRIGGERED!');
      console.log('   Check your Telegram for notifications.');
    } else {
      console.log('\n✅ No stop-loss triggers (all prices are above min_price)');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  console.log('\n================================');
  console.log('🏁 Test complete');
}

// Run test
testSentinel();
