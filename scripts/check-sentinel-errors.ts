// Quick diagnostic script to check sentinel errors
import { db, sentinelLogs } from '../src/infrastructure/database/db.js';
import { desc, eq } from 'drizzle-orm';

async function main() {
  console.log('🔍 Checking recent Sentinel errors...\n');

  // Get recent system errors
  const errors = await db.query.sentinelLogs.findMany({
    where: eq(sentinelLogs.defenseAction, 'SYSTEM_ERROR'),
    orderBy: desc(sentinelLogs.createdAt),
    limit: 10,
  });

  if (errors.length === 0) {
    console.log('✅ No SYSTEM_ERROR entries in sentinel_logs');
  } else {
    console.log(`❌ Found ${errors.length} SYSTEM_ERROR entries:`);
    for (const err of errors) {
      console.log(`\n  User: ${err.userId}`);
      console.log(`  Time: ${err.createdAt}`);
      console.log(`  Details: ${err.details}`);
    }
  }

  // Get recent logs of any type
  console.log('\n\n📋 Last 10 sentinel logs (any type):');
  const recentLogs = await db.query.sentinelLogs.findMany({
    orderBy: desc(sentinelLogs.createdAt),
    limit: 10,
  });

  for (const log of recentLogs) {
    console.log(
      `  [${log.createdAt}] User ${log.userId}: ${log.defenseAction} - ${log.threatType || 'N/A'} (${log.success ? '✓' : '✗'})`
    );
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
