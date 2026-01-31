import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../services/database.js';
import { sendAuthError } from './auth.js';
import { logger } from '../lib/logger.js';

/**
 * Middleware wrapper to enforce active subscription
 */
export async function withSubscription(
  req: VercelRequest,
  res: VercelResponse,
  handler: (req: VercelRequest, res: VercelResponse, userId: string | number) => Promise<unknown>,
  userId: string | number
) {
  try {
    // SYSTEM ADMIN BYPASS
    if (userId === 0 || userId === '0') {
      return handler(req, res, userId);
    }

    const result = await sql`
      SELECT subscription_active, subscription_end, subscription_plan 
      FROM users 
      WHERE id = ${userId}
    `;

    if (result.rows.length === 0) {
      return sendAuthError(res, 'User not found', 404);
    }

    const { subscription_active, subscription_end, subscription_plan } = result.rows[0];

    const isActive = subscription_active && new Date(subscription_end) > new Date();

    if (!isActive) {
      // Allow trial users strictly within trial window (logic handled by subscription_active flag usually, but double check)
      logger.warn(`[Access Denied] User ${userId} subscription expired or inactive.`);
      return res.status(402).json({
        error: 'Subscription expired or inactive',
        code: 'PAYMENT_REQUIRED',
        plan: subscription_plan,
        check_url: '/subscription',
      });
    }

    // Proceed
    return handler(req, res, userId);
  } catch (error) {
    logger.error('[Middleware] Subscription check failed', error);
    return res.status(500).json({ error: 'Internal subscription check error' });
  }
}
