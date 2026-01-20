#!/usr/bin/env npx tsx
/**
 * Sentinel Smoke Test
 * Verifies critical path connectivity (DB, Sentinel Orchestrator) without side effects.
 */

import 'dotenv/config';
import { sql } from '../../src/api-lib/services/database.js';
import { sentinelOrchestrator } from '../../src/sentinel/SentinelOrchestrator.js';

const withRetry = async <T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable = err.code === 'ECONNRESET' || err.message?.includes('closed');
      if (isRetryable && i < attempts - 1) {
        console.log(`   ⏳ Retry ${i + 1}/${attempts} for ${label}...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
};

async function smokeTest() {
  console.log('🌫️ Starting Sentinel Smoke Test...');

  // 1. Check DB Connection
  try {
    const start = Date.now();
    await withRetry(() => sql`SELECT 1 as ping`, 'DB Ping');
    console.log(`   ✅ Database connected (${Date.now() - start}ms)`);
  } catch (err) {
    console.error('   ❌ Database connection failed:', err);
    process.exit(1);
  }

  // 2. Check Sentinel Initialization
  try {
    if (!sentinelOrchestrator) {
      throw new Error('SentinelOrchestrator failed to initialize');
    }
    console.log('   ✅ Sentinel Orchestrator initialized');
  } catch (err) {
    console.error('   ❌ Sentinel initialization failed:', err);
    process.exit(1);
  }

  // 3. Check Critical Table Access (Read-only)
  try {
    const userCount = await withRetry(async () => {
      const res = await sql`SELECT COUNT(*) as count FROM users`;
      return res.rows[0].count;
    }, 'Users Count');
    console.log(`   ✅ Read access confirmed (Users: ${userCount})`);

    // Check sentinel_events existence (we just fixed this)
    const eventCount = await withRetry(async () => {
      const res = await sql`SELECT COUNT(*) as count FROM sentinel_events`;
      return res.rows[0].count;
    }, 'Sentinel Events Count');
    console.log(`   ✅ Sentinel Events table accessible (Events: ${eventCount})`);
  } catch (err) {
    console.error('   ❌ Critical table access failed:', err);
    process.exit(1);
  }

  console.log('✨ Smoke Test Passed: System is operationally ready.');
  process.exit(0);
}

smokeTest().catch(err => {
  console.error('💥 Smoke test crashed:', err);
  process.exit(1);
});
