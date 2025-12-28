import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminAccessAsync } from '../../src/api-lib/middleware/auth.js';
import { OpsLogger } from '../../src/api-lib/services/ops-logger.js';
import { sendAuthError } from '../../src/api-lib/middleware/auth.js';
import { sql } from '@vercel/postgres';

export async function handleOpsEvents(req: VercelRequest, res: VercelResponse) {
  if (!(await verifyAdminAccessAsync(req))) {
    return sendAuthError(res, 'Unauthorized', 401, req);
  }

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const events = await OpsLogger.getRecentEvents(limit);
    return res.status(200).json({ events });
  } catch (error) {
    console.error('Ops Events Error:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

export async function handleOpsAudit(req: VercelRequest, res: VercelResponse) {
  if (!(await verifyAdminAccessAsync(req))) {
    return sendAuthError(res, 'Unauthorized', 401, req);
  }

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const logs = await OpsLogger.getAuditLogs(limit);
    return res.status(200).json({ logs });
  } catch (error) {
    console.error('Ops Audit Error:', error);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

export async function handleOpsDashboard(req: VercelRequest, res: VercelResponse) {
  if (!(await verifyAdminAccessAsync(req))) {
    return sendAuthError(res, 'Unauthorized', 401, req);
  }

  try {
    // Gather basic metrics
    const [eventsCount, auditCount, errorsCount] = await Promise.all([
      sql`SELECT count(*) FROM ops_events`,
      sql`SELECT count(*) FROM ops_audit`,
      sql`SELECT count(*) FROM ops_events WHERE severity = 'error' OR severity = 'critical'`,
    ]);

    // Get recent critical alerts
    const criticalAlerts = await sql`
      SELECT * FROM ops_events 
      WHERE severity = 'critical' 
      ORDER BY created_at DESC 
      LIMIT 5
    `;

    return res.status(200).json({
      metrics: {
        totalEvents: eventsCount.rows[0].count,
        totalAuditLogs: auditCount.rows[0].count,
        errorRate: errorsCount.rows[0].count,
      },
      alerts: criticalAlerts.rows,
    });
  } catch (error) {
    console.error('Ops Dashboard Error:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
}
