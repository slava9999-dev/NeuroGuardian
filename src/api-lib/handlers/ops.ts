// ============================================
// NeuroGUARDIAN — Operations Dashboard Handler
// Endpoints for admin dashboard and monitoring
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractAnyAuth, sendAuthError, sendMethodNotAllowed } from '../middleware/auth.js';
import {
  getPendingEvents,
  getUserEvents,
  getEventStats,
  getAuditTrail,
  getRecentAuditEntries,
  markEventProcessed,
  getSystemEvents,
} from '../services/ops-logger.js';
import { getUsersStats, getUsersPaginated } from '../services/users.js';
import {
  triggerSyncProducts,
  triggerRetryOnboarding,
  triggerN8nWorkflow,
  getN8nSystemHealth,
} from '../services/index.js';

// ============================================
// HANDLERS
// ============================================

/**
 * GET/POST /api?action=ops-events
 * Get events or mark them as processed
 */
export async function handleOpsEvents(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  const auth = extractAnyAuth(req);
  if (auth.success === false) {
    return sendAuthError(res, auth.error, auth.statusCode);
  }

  const isAdmin = auth.context.authMethod === 'admin' || auth.context.authMethod === 'cron';

  if (req.method === 'GET') {
    const type = req.query.type as string; // 'recent' or 'pending'

    if (type === 'pending') {
      // Admin only
      if (!isAdmin) {
        return sendAuthError(res, 'Admin access required', 403);
      }
      const events = await getPendingEvents();
      return res.status(200).json({ success: true, events });
    } else if (type === 'recent') {
      // Admin only - System Wide Events
      if (!isAdmin) {
        return sendAuthError(res, 'Admin access required', 403);
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await getSystemEvents(limit);
      return res.status(200).json({ success: true, events });
    } else {
      // User events
      const userId =
        isAdmin && req.query.userId ? parseInt(req.query.userId as string) : auth.context.userId;

      const events = await getUserEvents(userId);
      return res.status(200).json({ success: true, events });
    }
  } else if (req.method === 'POST') {
    // Mark processed (Admin/System only)
    if (!isAdmin) {
      return sendAuthError(res, 'Admin access required', 403);
    }

    const { eventId, result } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'Missing eventId' });
    }

    await markEventProcessed(eventId, result || { manually_processed: true });
    return res.status(200).json({ success: true });
  } else {
    return sendMethodNotAllowed(res);
  }
}

/**
 * GET /api?action=ops-audit
 * Get audit trail
 */
export async function handleOpsAudit(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  const auth = extractAnyAuth(req);
  if (auth.success === false) {
    return sendAuthError(res, auth.error, auth.statusCode);
  }

  const isAdmin = auth.context.authMethod === 'admin' || auth.context.authMethod === 'cron';

  // Admin access required for full audit
  if (!isAdmin) {
    return sendAuthError(res, 'Admin access required', 403);
  }

  const resourceType = req.query.resourceType as string;
  const resourceId = req.query.resourceId as string;

  let records;
  if (resourceType && resourceId) {
    records = await getAuditTrail(resourceType as any, resourceId);
  } else {
    records = await getRecentAuditEntries();
  }

  return res.status(200).json({ success: true, records });
}

/**
 * GET /api?action=ops-dashboard
 * Aggregated stats for dashboard
 */
export async function handleOpsDashboard(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  const auth = extractAnyAuth(req);
  if (auth.success === false) {
    return sendAuthError(res, auth.error, auth.statusCode);
  }

  const isAdmin = auth.context.authMethod === 'admin' || auth.context.authMethod === 'cron';

  try {
    const userId =
      isAdmin && req.query.userId ? parseInt(req.query.userId as string) : auth.context.userId;

    const stats = await getEventStats(userId);

    return res.status(200).json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard stats failed:', error);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

/**
 * GET /api?action=ops-overview
 * Main dashboard overview data (clients, integrations, etc.)
 */
export async function handleOpsOverview(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  const auth = extractAnyAuth(req);
  if (auth.success === false) {
    return sendAuthError(res, auth.error, auth.statusCode);
  }

  const isAdmin = auth.context.authMethod === 'admin' || auth.context.authMethod === 'cron';
  if (!isAdmin) {
    return sendAuthError(res, 'Admin access required', 403);
  }

  try {
    const clientsStats = await getUsersStats();

    const n8nHealth = await getN8nSystemHealth();

    // In Phase 1, integrations status is basic check
    const integrations = {
      wb: { status: 'ok', latency: 45 }, // mock
      ozon: { status: 'ok', latency: 52 }, // mock
      n8n: {
        status:
          n8nHealth.status === 'active' || n8nHealth.status === 'drift'
            ? n8nHealth.status
            : 'inactive',
        workflows_active: n8nHealth.workflows_active,
      },
      security: {
        status: 'active',
        policy_version: '1.2.0',
      },
    };

    // Get recent security events for overview
    const recentEvents = await getSystemEvents(5);

    return res.status(200).json({
      success: true,
      data: {
        clients: clientsStats,
        integrations,
        n8n: integrations.n8n,
        security: integrations.security,
        recent_events: recentEvents,
      },
    });
  } catch (error) {
    console.error('Ops Overview failed:', error);
    return res.status(500).json({ error: 'Failed to load overview' });
  }
}

/**
 * GET /api?action=ops-clients
 * Paginated clients list
 */
export async function handleOpsClients(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  const auth = extractAnyAuth(req);
  if (auth.success === false) {
    return sendAuthError(res, auth.error, auth.statusCode);
  }

  const isAdmin = auth.context.authMethod === 'admin';
  if (!isAdmin) {
    return sendAuthError(res, 'Admin access required', 403);
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    const users = await getUsersPaginated(limit, offset, search);
    const stats = await getUsersStats(); // inefficient to call twice but okay for now

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: stats.total, // Approximate total from stats
        pages: Math.ceil(stats.total / limit),
      },
    });
  } catch (error) {
    console.error('Ops Clients failed:', error);
    return res.status(500).json({ error: 'Failed to load clients' });
  }
}

/**
 * POST /api?action=ops-action
 * Trigger operational manual actions (Runbook)
 */
export async function handleOpsAction(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);

  const auth = extractAnyAuth(req);
  if (auth.success === false) return sendAuthError(res, auth.error, auth.statusCode);

  const isAdmin = auth.context.authMethod === 'admin';
  if (!isAdmin) return sendAuthError(res, 'Admin access required', 403);

  const { action, userId, payload } = req.body;
  if (!action || !userId) {
    return res.status(400).json({ error: 'Missing action or userId' });
  }

  try {
    let success = false;
    let message = '';

    switch (action) {
      case 'sync_products':
        success = await triggerSyncProducts(parseInt(userId));
        message = 'Sync products workflow triggered';
        break;
      case 'retry_onboarding':
        success = await triggerRetryOnboarding(parseInt(userId));
        message = 'Retry onboarding workflow triggered';
        break;
      // Generic case for other workflows
      default:
        // For security, only allow actions starting with "n8n_" or explicit list
        if (action.startsWith('n8n_')) {
          success = await triggerN8nWorkflow(action.replace('n8n_', ''), {
            action,
            userId: parseInt(userId),
            ...payload,
          });
          message = `Workflow ${action} triggered`;
        } else if (action === 'check_prices') {
          // Example internal action
          message = 'Check prices triggered (simulation)';
          success = true; // Placeholder
        } else {
          return res.status(400).json({ error: 'Unknown action' });
        }
    }

    if (success) {
      return res.status(200).json({ success: true, message });
    } else {
      return res.status(502).json({ error: 'Failed to trigger action upstream' });
    }
  } catch (e: any) {
    console.error('Ops Action Failed:', e);
    return res.status(500).json({ error: e.message });
  }
}
