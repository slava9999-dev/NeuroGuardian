import { db, sentinelLogs } from '../infrastructure/database/db.js';
import { sql } from 'drizzle-orm';
import { logger } from '../api-lib/lib/logger.js';

export class SentinelHealthScout {
  /**
   * Generates a high-level health report for the Sentinel Agent
   */
  async getHealthReport() {
    try {
      // 1. Calculate Success Rate (last 24h)
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const stats = await db
        .select({
          total: sql`count(*)`,
          success: sql`count(CASE WHEN success = true THEN 1 END)`,
          saved: sql`sum(saved_amount)`,
          threats: sql`count(DISTINCT threat_type)`,
        })
        .from(sentinelLogs)
        .where(sql`created_at > ${last24h.toISOString()}`);

      const report = {
        timestamp: new Date(),
        dailyStats: stats[0],
        status:
          Number(stats[0]?.success) / Number(stats[0]?.total || 1) > 0.9 ? 'OPTIMAL' : 'WARNED',
        engineDetails: {
          method: 'Digital Vision (Playwright)',
          workers: 10,
          activeProxies: process.env.PROXY_URLS ? process.env.PROXY_URLS.split(',').length : 0,
        },
      };

      logger.info('[HealthScout] Industrial report generated', { status: report.status });
      return report;
    } catch (e) {
      logger.error('[HealthScout] Failed to generate report', e);
      return null;
    }
  }
}

export const healthScout = new SentinelHealthScout();
