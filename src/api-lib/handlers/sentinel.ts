// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring entry point
// REFACTORED: Uses SentinelService class (TZ v2.0)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminAccessAsync, extractAnyAuthAsync } from '../middleware/auth.js';

/**
 * Handle check-prices action (Sentinel Cron)
 */
export async function handleCheckPrices(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { sentinelService } = await import('../services/sentinel-service.js');
  const { getSecret } = await import('../lib/secrets-helper.js');

  // 1. Authentication Strategy
  // Priority 1: Specific User Context (Telegram, Cron+ID, Admin+ID)
  // This supports providing X-Telegram-Id along with the Cron Secret to run for a specific user.
  const authResult = await extractAnyAuthAsync(req);

  // Priority 2: Global Admin/Cron Access (No ID provided)
  let isGlobalAdmin = await verifyAdminAccessAsync(req);

  // Legacy: Check query param secret if verification failed
  if (!isGlobalAdmin && !authResult.success) {
    const querySecret = req.query.secret as string;
    if (querySecret) {
      try {
        const expectedSecret = await getSecret('cron_secret', 'sentinel_cron');
        if (querySecret === expectedSecret || querySecret === process.env.CRON_SECRET) {
          isGlobalAdmin = true;
          console.log('✅ Authenticated via cron query param');
        }
      } catch {
        if (querySecret === process.env.CRON_SECRET) {
          isGlobalAdmin = true;
          console.log('✅ Authenticated via cron query param (env fallback)');
        }
      }
    }
  }

  try {
    let result;

    if (authResult.success) {
      console.log(
        `🛡️ SENTINEL: Starting check for user ${authResult.context.userId} (Method: ${authResult.context.authMethod})...`
      );
      result = await sentinelService.runForUser(authResult.context.userId);
    } else if (isGlobalAdmin) {
      console.log('🛡️ SENTINEL: Starting full global cycle (Admin/Cron)...');
      result = await sentinelService.runCycle();
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
      success: true,
      scanned: result.usersProcessed,
      triggered: result.actionsTaken,
      violations_found: result.threatsDetected,
      errors: result.errors,
      message: isGlobalAdmin ? 'Full cycle completed' : 'User check completed',
    });
  } catch (error) {
    console.error('Sentinel Handler Error:', error);
    return res.status(500).json({ error: 'Sentinel check failed' });
  }
}

/**
 * Handle individual sentinel status/stats
 */
export async function handleSentinelStats(
  _req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { sql } = await import('@vercel/postgres');

  try {
    const logs = await sql`
      SELECT * FROM sentinel_logs 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 10
    `;

    const summary = await sql`
      SELECT 
        COUNT(*) as total_actions,
        SUM(saved_amount) as total_saved
      FROM sentinel_logs
      WHERE user_id = ${userId}
    `;

    return res.json({
      success: true,
      recentActions: logs.rows,
      stats: summary.rows[0],
      // Handle case where no stats exist yet (null result)
      totalSaved: summary.rows[0]?.total_saved || 0,
      totalActions: summary.rows[0]?.total_actions || 0,
    });
  } catch (error) {
    console.error('Sentinel Stats Error:', error);
    return res.status(500).json({ error: 'Failed to fetch sentinel stats' });
  }
}
