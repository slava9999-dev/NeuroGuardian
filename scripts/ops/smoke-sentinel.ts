import { sentinelOrchestrator } from '../../src/sentinel/SentinelOrchestrator.js';
import { sql } from '../../src/api-lib/services/database.js';
import { logger } from '../../src/api-lib/lib/logger.js';

/**
 * Sentinel Smoke Test
 * Verifies that the sentinel core can process at least one user without crashing.
 */

async function runSmokeTest() {
  console.log('🛡️  SENTINEL SMOKE TEST');

  try {
    // 1. Find a candidate user (prefer Alexander if exists, otherwise first active)
    const userRes = await sql`
      SELECT id, first_name FROM users 
      WHERE is_active = true 
      ORDER BY (id = '1600992954') DESC, id ASC 
      LIMIT 1
    `;

    if (userRes.rows.length === 0) {
      console.log('⚠️ No active users found in database. Skipping test.');
      process.exit(0);
    }

    const user = userRes.rows[0];
    console.log(`👤 Testing with user: ${user.first_name} (${user.id})`);

    // 2. Run Sentinel for this user
    const start = Date.now();
    const result = await sentinelOrchestrator.runForUser(user.id);
    const duration = Date.now() - start;

    // 3. Verify Results
    console.log('\n📊 TEST RESULTS:');
    console.log(`- Time: ${duration}ms`);
    console.log(`- Products Scanned: ${result.productsScanned.wb + result.productsScanned.ozon}`);
    console.log(`- Threats Detected: ${result.threatsDetected}`);
    console.log(`- Actions Taken: ${result.actionsTaken}`);

    if (result.errors && result.errors.length > 0) {
      console.log('❌ ERRORS DETECTED:');
      result.errors.forEach(e => console.log(`  • ${e}`));

      // If errors are critical (not just marketplace API issues), fail the test
      const criticalErrors = result.errors.filter(
        e => !e.includes('429') && !e.includes('timeout')
      );
      if (criticalErrors.length > 0) {
        console.log('\n🔴 SMOKE TEST FAILED: Critical errors found.');
        process.exit(1);
      }
    }

    console.log('\n🟢 SMOKE TEST PASSED. Sentinel core is stable.');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 SMOKE TEST CRASHED:', err);
    process.exit(1);
  }
}

runSmokeTest();
