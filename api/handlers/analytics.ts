// ============================================
// NeuroGUARDIAN — Analytics Handler
// System metrics and daily reports
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

import { extractCronAuthAsync, extractAdminAuthAsync } from '../../src/api-lib/middleware/auth.js';

/**
 * Handle get-analytics action
 * Returns daily statistics for monitoring
 */
export async function handleGetAnalytics(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Authorization check
  const isCron = await extractCronAuthAsync(req);
  const isAdmin = await extractAdminAuthAsync(req);

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get date range (last 24 hours)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Active subscriptions
    const subscriptionsResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE subscription_active = true) as active_count,
        COUNT(*) FILTER (
          WHERE subscription_active = true 
          AND subscription_end_date <= NOW() + INTERVAL '3 days'
        ) as expiring_soon_count
      FROM users
    `;

    // 2. Protected products
    const protectedProductsResult = await sql`
      SELECT 
        COUNT(*) as total_protected,
        COUNT(DISTINCT user_id) as users_with_protection,
        AVG(min_price) as avg_min_price
      FROM products
      WHERE min_price IS NOT NULL AND min_price > 0
    `;

    // 3. Sentinel activity (last 24 hours)
    const sentinelActivityResult = await sql`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE action_type = 'price_correction') as price_corrections,
        COUNT(*) FILTER (WHERE action_type = 'zero_stock') as zero_stocks,
        COUNT(*) FILTER (WHERE success = true) as successful_actions,
        COUNT(*) FILTER (WHERE success = false) as failed_actions
      FROM defense_logs
      WHERE created_at >= ${yesterday.toISOString()}
    `;

    // 4. Calculate "saved money" (difference between current price and min_price for violations)
    const savedMoneyResult = await sql`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN dl.action_type = 'price_correction' AND dl.success = true
            THEN (dl.old_price - p.min_price)
            ELSE 0
          END
        ), 0) as total_saved
      FROM defense_logs dl
      LEFT JOIN products p ON dl.product_id = p.id
      WHERE dl.created_at >= ${yesterday.toISOString()}
    `;

    // 5. User activity
    const userActivityResult = await sql`
      SELECT 
        COUNT(DISTINCT user_id) as active_users
      FROM users
      WHERE last_active >= ${yesterday.toISOString()}
    `;

    const analytics = {
      timestamp: now.toISOString(),
      period: '24h',
      subscriptions: {
        active: parseInt(subscriptionsResult.rows[0]?.active_count || '0'),
        expiring_soon: parseInt(subscriptionsResult.rows[0]?.expiring_soon_count || '0'),
      },
      products: {
        total_protected: parseInt(protectedProductsResult.rows[0]?.total_protected || '0'),
        users_with_protection: parseInt(
          protectedProductsResult.rows[0]?.users_with_protection || '0'
        ),
        avg_min_price: parseFloat(protectedProductsResult.rows[0]?.avg_min_price || '0'),
      },
      sentinel: {
        total_actions: parseInt(sentinelActivityResult.rows[0]?.total_actions || '0'),
        price_corrections: parseInt(sentinelActivityResult.rows[0]?.price_corrections || '0'),
        zero_stocks: parseInt(sentinelActivityResult.rows[0]?.zero_stocks || '0'),
        successful: parseInt(sentinelActivityResult.rows[0]?.successful_actions || '0'),
        failed: parseInt(sentinelActivityResult.rows[0]?.failed_actions || '0'),
        success_rate:
          sentinelActivityResult.rows[0]?.total_actions > 0
            ? (
                (parseInt(sentinelActivityResult.rows[0]?.successful_actions || '0') /
                  parseInt(sentinelActivityResult.rows[0]?.total_actions || '1')) *
                100
              ).toFixed(2)
            : '0',
      },
      money_saved: {
        total_rub: parseFloat(savedMoneyResult.rows[0]?.total_saved || '0').toFixed(2),
      },
      users: {
        active_last_24h: parseInt(userActivityResult.rows[0]?.active_users || '0'),
      },
    };

    return res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    });
  }
}

/**
 * Handle get-system-metrics action
 * Returns real-time system health metrics
 */
export async function handleGetSystemMetrics(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Authorization check
  const isCron = await extractCronAuthAsync(req);
  const isAdmin = await extractAdminAuthAsync(req);

  if (!isCron && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get subscriptions expiring soon
    const expiringSubscriptionsResult = await sql`
      SELECT 
        user_id,
        telegram_id,
        subscription_end_date
      FROM users
      WHERE subscription_active = true
      AND subscription_end_date <= NOW() + INTERVAL '3 days'
      ORDER BY subscription_end_date ASC
      LIMIT 10
    `;

    // Get recent Sentinel errors
    const recentErrorsResult = await sql`
      SELECT 
        COUNT(*) as error_count
      FROM defense_logs
      WHERE success = false
      AND created_at >= NOW() - INTERVAL '1 hour'
    `;

    // Get last Sentinel run
    const lastSentinelRunResult = await sql`
      SELECT 
        MAX(created_at) as last_run
      FROM defense_logs
    `;

    const metrics = {
      timestamp: new Date().toISOString(),
      subscriptions: {
        expiring_soon: expiringSubscriptionsResult.rows.map(row => ({
          user_id: row.user_id,
          telegram_id: row.telegram_id,
          expires_at: row.subscription_end_date,
        })),
      },
      sentinel: {
        last_run: lastSentinelRunResult.rows[0]?.last_run || null,
        errors_last_hour: parseInt(recentErrorsResult.rows[0]?.error_count || '0'),
      },
      api: {
        health: 'ok',
        uptime_seconds: process.uptime(),
      },
    };

    return res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error getting system metrics:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get system metrics',
    });
  }
}
