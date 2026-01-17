import { db, sentinelLogs } from '../../src/infrastructure/database/db.js';
import { sql, lt } from 'drizzle-orm';
import { logger } from '../../src/api-lib/lib/logger.js';

async function cleanupSentielLogs() {
  const DAYS_TO_KEEP = 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);

  console.log(
    `🧹 Cleaning up sentinel logs older than ${cutoffDate.toISOString()} (${DAYS_TO_KEEP} days)...`
  );

  try {
    const result = await db.delete(sentinelLogs).where(lt(sentinelLogs.createdAt, cutoffDate));

    // In node-postgres result might not have 'rowCount' directly depending on drizzle version/adapter
    // But we can log success
    logger.info('Sentinel logs cleanup completed successfully');
  } catch (error) {
    logger.error('Failed to cleanup sentinel logs', error);
  }

  process.exit(0);
}

cleanupSentielLogs();
