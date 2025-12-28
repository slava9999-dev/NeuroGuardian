// ============================================
// NeuroGUARDIAN — Analytics Handler
// System metrics and daily reports
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

import { extractCronAuthAsync, extractAdminAuthAsync } from '../middleware/auth.js';

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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Active subscriptions
    const subscriptionsResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE subscription_active = true) as active_count,
        COUNT(*) FILTER (
          WHERE subscription_active = true 
          AND subscription_end <= NOW() + INTERVAL '3 days'
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

    // 3. Sentinel activity (last 24 hours) - table name FIXED
    const sentinelActivityResult = await sql`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE defense_action = 'price_correction') as price_corrections,
        COUNT(*) FILTER (WHERE defense_action = 'zero_stock') as zero_stocks,
        COUNT(*) FILTER (WHERE success = true) as successful_actions,
        COUNT(*) FILTER (WHERE success = false) as failed_actions,
        COUNT(*) FILTER (WHERE threat_type = 'ozon_card_erosion' OR threat_type = 'margin_below_zero') as erosion_threats
      FROM sentinel_logs
      WHERE created_at >= ${yesterday.toISOString()}
    `;

    // 4. Calculate "saved money"
    const savedMoneyResult = await sql`
      SELECT 
        COALESCE(SUM(saved_amount), 0) as total_saved
      FROM sentinel_logs
      WHERE created_at >= ${yesterday.toISOString()} 
      AND success = true
    `;

    // 5. User activity
    // Note: last_active is not present in schema shown in database.ts so relying on updated_at or similar might be needed.
    // Assuming updated_at on users usage or transactions.
    // Schema in database.ts has updated_at.
    const userActivityResult = await sql`
      SELECT 
        COUNT(DISTINCT id) as active_users
      FROM users
      WHERE updated_at >= ${yesterday.toISOString()}
    `;

    // 6. ABC Analysis (Real Data)
    // We analyze orders from the last 30 days
    const abcResult = await sql`
      WITH product_sales AS (
          SELECT 
              product_id, 
              SUM(price_total) as revenue
          FROM marketplace_orders
          WHERE order_date >= ${thirtyDaysAgo.toISOString()}
          GROUP BY product_id
      ),
      total_revenue AS (
          SELECT SUM(revenue) as total FROM product_sales
      ),
      ranked_sales AS (
          SELECT 
              product_id,
              revenue,
              SUM(revenue) OVER (ORDER BY revenue DESC) as running_total,
              (SELECT total FROM total_revenue) as total_rev
          FROM product_sales
      )
      SELECT 
          CASE 
              WHEN running_total <= total_rev * 0.8 THEN 'A'
              WHEN running_total <= total_rev * 0.95 THEN 'B'
              ELSE 'C'
          END as abc_class,
          COUNT(*) as count
      FROM ranked_sales
      GROUP BY 1
    `;

    const abcStats = {
      A: 0,
      B: 0,
      C: 0,
    };
    abcResult.rows.forEach(row => {
      if (row.abc_class === 'A') abcStats.A = parseInt(row.count);
      if (row.abc_class === 'B') abcStats.B = parseInt(row.count);
      if (row.abc_class === 'C') abcStats.C = parseInt(row.count);
    });

    // 7. Stock Forecast (Real Data)
    // Compare current stock with average daily sales (last 30 days)
    const stockForecastResult = await sql`
      WITH sales_velocity AS (
          SELECT 
              product_id,
              COUNT(*) / 30.0 as avg_daily_sales
          FROM marketplace_orders
          WHERE order_date >= ${thirtyDaysAgo.toISOString()}
          GROUP BY product_id
      ),
      stock_status AS (
          SELECT 
              p.current_stock,
              COALESCE(s.avg_daily_sales, 0) as velocity
          FROM products p
          LEFT JOIN sales_velocity s ON p.product_id = s.product_id
          WHERE p.current_stock > 0
      )
      SELECT 
          CASE 
              WHEN velocity <= 0 THEN 'unknown'
              WHEN current_stock / velocity < 7 THEN 'critical'     -- < 7 days
              WHEN current_stock / velocity < 30 THEN 'warning'     -- 7-30 days
              ELSE 'ok'                                             -- > 30 days
          END as status,
          COUNT(*) as count
      FROM stock_status
      GROUP BY 1
    `;

    const stockStats = {
      critical: 0, // < 7 days
      warning: 0, // 7-30 days
      ok: 0, // > 30 days
      unknown: 0, // No sales
    };
    stockForecastResult.rows.forEach(row => {
      if (row.status === 'critical') stockStats.critical = parseInt(row.count);
      if (row.status === 'warning') stockStats.warning = parseInt(row.count);
      if (row.status === 'ok') stockStats.ok = parseInt(row.count);
      if (row.status === 'unknown') stockStats.unknown = parseInt(row.count);
    });

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
        erosion_threats: parseInt(sentinelActivityResult.rows[0]?.erosion_threats || '0'),
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
      abc: abcStats,
      stock_health: stockStats,
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
