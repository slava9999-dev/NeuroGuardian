import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../services/database.js';
import { verifyAdminAccessAsync, extractTelegramAuth } from '../middleware/auth.js';
import { sentinelOrchestrator } from '../../sentinel/SentinelOrchestrator.js';
import { memoryService } from '../services/memory-service.js';

/**
 * GOD MODE: System Control Handler
 * Strictly for Super Admins.
 */
export async function handleAdminSystem(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // 1. Strict Admin Security
  let isAdmin = await verifyAdminAccessAsync(req);

  // 2. Allow Super Admins via Telegram Auth (if not authenticated via key)
  if (!isAdmin) {
    const tgAuth = extractTelegramAuth(req);
    if (tgAuth.success) {
      const SUPER_ADMINS = [
        7548070478, // Slava
        ...(process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
      ];
      if (SUPER_ADMINS.includes(tgAuth.context.userId)) {
        isAdmin = true;
      }
    }
  }

  if (!isAdmin) {
    // Security by Obscurity: 404 instead of 403 to hide existence
    return res.status(404).json({ error: 'Not found' });
  }

  const { method } = req;
  const subAction = req.body?.subAction as string;

  try {
    // GET: System Stats (The HUD)
    if (method === 'GET') {
      const startTime = Date.now();

      // Parallel data fetching for speed
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_pingResult, sentinelLogs, activeUsers, opsEvents] = await Promise.all([
        // 1. DB Latency Check
        sql`SELECT 1 as ping`,

        // 2. Latest Sentinel Activity
        sql`SELECT created_at, success FROM sentinel_logs ORDER BY created_at DESC LIMIT 1`,

        // 3. Active Users (last 24h)
        sql`SELECT COUNT(DISTINCT user_id) as count FROM ops_events WHERE timestamp > NOW() - INTERVAL '24 hours'`,

        // 4. Ops Events (Errors)
        sql`SELECT COUNT(*) as count FROM ops_events WHERE event_type LIKE '%error%' AND timestamp > NOW() - INTERVAL '1 hour'`,
      ]);

      const dbLatency = Date.now() - startTime;

      const lastSentinelRun = sentinelLogs.rows[0]?.created_at || null;
      const sentinelStatus = sentinelLogs.rows[0]?.success ? 'healthy' : 'degraded';

      // 5. Memory / Vector DB Health
      const memoryHealth = await memoryService.getHealth();

      // 6. Check Emergency Stop Status
      // We lazily create the table if it implies a read might fail, but checking existence is better.
      // For speed, let's just query. If table doesn't exist, it errors, which we catch.
      // Actually, let's just use a try/catch for the flag check or assume table exists (we will create it in POST).
      let emergencyStopActive = false;
      try {
        const flagResult =
          await sql`SELECT value_bool FROM system_flags WHERE key = 'sentinel_emergency_stop'`;
        emergencyStopActive = flagResult.rows[0]?.value_bool || false;
      } catch {
        // Table likely doesn't exist
      }

      return res.json({
        success: true,
        cluster: {
          region: process.env.VERCEL_REGION || 'dev',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        health: {
          database: {
            status: 'connected',
            latencyMs: dbLatency,
          },
          memory: {
            chroma: memoryHealth.chromaHealthy ? 'connected' : 'disconnected',
            kv: memoryHealth.kvHealthy ? 'connected' : 'disconnected',
          },
          sentinel: {
            status: emergencyStopActive ? 'emergency_stopped' : sentinelStatus,
            lastRun: lastSentinelRun,
            timeSinceRun: lastSentinelRun
              ? (Date.now() - new Date(lastSentinelRun).getTime()) / 1000
              : null,
            emergencyStop: emergencyStopActive,
          },
        },
        metrics: {
          activeUsers24h: Number(activeUsers.rows[0]?.count || 0),
          errorsLastHour: Number(opsEvents.rows[0]?.count || 0),
        },
        featureFlags: await (async () => {
          try {
            const flags =
              await sql`SELECT key, value_bool FROM system_flags WHERE key LIKE 'feature_%'`;
            return Object.fromEntries(
              flags.rows.map(f => [f.key.replace('feature_', ''), f.value_bool])
            );
          } catch {
            return {};
          }
        })(),
      });
    }

    // POST: Control Actions (War Room)
    if (method === 'POST') {
      switch (subAction) {
        case 'force_sentinel': {
          console.log('[GOD MODE] Forcing Sentinel Cycle...');
          // Check if emergency stop is active
          try {
            const flagResult =
              await sql`SELECT value_bool FROM system_flags WHERE key = 'sentinel_emergency_stop'`;
            if (flagResult.rows[0]?.value_bool) {
              return res
                .status(403)
                .json({ success: false, message: 'Sentinel is in EMERGENCY STOP mode.' });
            }
          } catch {
            /* ignore */
          }

          const result = await sentinelOrchestrator.runCycle();
          return res.json({
            success: true,
            message: 'Sentinel Cycle Completed',
            data: result,
          });
        }

        case 'emergency_stop': {
          console.warn('[GOD MODE] 🚨 ACTIVATING EMERGENCY STOP 🚨');
          // Lazily create table
          await sql`CREATE TABLE IF NOT EXISTS system_flags (key TEXT PRIMARY KEY, value_bool BOOLEAN, updated_at TIMESTAMP DEFAULT NOW())`;

          const enable = req.body?.enable !== false; // Default to true (stop!)

          await sql`
            INSERT INTO system_flags (key, value_bool, updated_at) 
            VALUES ('sentinel_emergency_stop', ${enable}, NOW())
            ON CONFLICT (key) DO UPDATE SET value_bool = EXCLUDED.value_bool, updated_at = NOW()
          `;

          return res.json({
            success: true,
            message: enable ? 'SYSTEM HALTED' : 'SYSTEM RESUMED',
            status: enable ? 'stopped' : 'running',
          });
        }

        case 'clear_cache': {
          // Not implemented yet
          return res.json({ success: true, message: 'Cache cleared (mock)' });
        }

        case 'toggle_feature': {
          const { feature, enabled } = req.body || {};
          if (!feature) return res.status(400).json({ error: 'feature name required' });

          await sql`CREATE TABLE IF NOT EXISTS system_flags (key TEXT PRIMARY KEY, value_bool BOOLEAN, updated_at TIMESTAMP DEFAULT NOW())`;

          await sql`
            INSERT INTO system_flags (key, value_bool, updated_at) 
            VALUES (${`feature_${feature}`}, ${enabled}, NOW())
            ON CONFLICT (key) DO UPDATE SET value_bool = EXCLUDED.value_bool, updated_at = NOW()
          `;

          return res.json({
            success: true,
            feature,
            enabled,
          });
        }

        default:
          return res.status(400).json({ error: 'Unknown subAction' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[GOD MODE] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'System Failure',
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
    });
  }
}
