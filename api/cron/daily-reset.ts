// ============================================
// NeuroGUARDIAN — Daily Reset Cron Job
// Runs at midnight to reset daily counters
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { resetDailyCounters } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow from Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow manual trigger with admin key
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('🕐 Running daily reset...');
    await resetDailyCounters();
    console.log('✅ Daily reset completed');

    return res.status(200).json({
      success: true,
      message: 'Daily counters reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Daily reset error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to reset counters',
    });
  }
}
