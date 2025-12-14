// ============================================
// NeuroGUARDIAN — Health Check API
// GET /api/health — Check API status
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks: Record<string, boolean | string> = {
    api: true,
    timestamp: new Date().toISOString(),
  };

  // Check database connection
  try {
    await sql`SELECT 1`;
    checks.database = true;
  } catch (error) {
    checks.database = false;
    checks.databaseError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check environment variables
  checks.hasPostgresUrl = !!process.env.POSTGRES_URL;
  checks.hasTelegramToken = !!process.env.TELEGRAM_BOT_TOKEN;
  checks.hasYookassaShopId = !!process.env.YOOKASSA_SHOP_ID;

  const isHealthy = checks.database === true;

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: '2.0.0-vercel',
    ...checks,
  });
}
