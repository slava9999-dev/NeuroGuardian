// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring entry point
// REFACTORED: Uses SentinelService class (TZ v2.0)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminAccessAsync, extractTelegramAuth } from '../middleware/auth.js';

/**
 * Handle check-prices action (Sentinel Cron)
 */
export async function handleCheckPrices(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { sentinelService } = await import('../services/sentinel-service.js');

  // 1. Authentication
  const isAdmin = await verifyAdminAccessAsync(req);
  const auth = extractTelegramAuth(req);

  try {
    let result;

    if (isAdmin) {
      console.log('🛡️ SENTINEL: Starting full global cycle (Admin/Cron)...');
      result = await sentinelService.runCycle();
    } else if (auth.success) {
      console.log(`🛡️ SENTINEL: Starting check for user ${auth.context.userId}...`);
      result = await sentinelService.runForUser(auth.context.userId);
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({
      success: true,
      scanned: result.usersProcessed,
      triggered: result.actionsTaken,
      violations_found: result.threatsDetected,
      errors: result.errors,
      message: isAdmin ? 'Full cycle completed' : 'User check completed',
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
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch sentinel stats' });
  }
}
