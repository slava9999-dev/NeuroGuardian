// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring entry point
// REFACTORED: Uses SentinelService class (TZ v2.0)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DBProduct } from '../lib/types.js';
import { verifyAdminAccessAsync, extractAnyAuthAsync } from '../middleware/auth.js';

/**
 * Handle check-prices action (Sentinel Cron)
 * Supports ?includeReport=true to send daily report after price check (for Vercel Hobby single-cron limit)
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

/**
 * Handle Sentinel Dashboard — Real-time threat display and analytics
 * Production-ready endpoint for frontend dashboard
 */
export async function handleSentinelDashboard(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const { sql } = await import('@vercel/postgres');
  const { ThreatDetector } = await import('../sentinel-core/ThreatDetector.js');
  const threatDetector = new ThreatDetector();
  const { getMarketplaceKeys, fetchWbPrices, fetchOzonCurrentPrices } =
    await import('../services/marketplace-bridge.js');

  try {
    const { timeRange = '24h' } = req.query;

    // Calculate time filter
    let hoursBack = 24;
    if (timeRange === '1h') hoursBack = 1;
    else if (timeRange === '7d') hoursBack = 168;
    else if (timeRange === '30d') hoursBack = 720;

    const timeFilter = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // 1. Get recent sentinel actions (defense history)
    const actionsResult = await sql`
      SELECT 
        id, product_id, product_title, detected_price, min_price, 
        defense_action, saved_amount, marketplace, threat_type, 
        success, created_at
      FROM sentinel_logs 
      WHERE user_id = ${userId} 
        AND created_at >= ${timeFilter.toISOString()}
      ORDER BY created_at DESC 
      LIMIT 50
    `;

    // 2. Get aggregated stats
    const statsResult = await sql`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_actions,
        COALESCE(SUM(saved_amount), 0) as total_saved,
        COUNT(DISTINCT product_id) as unique_products_protected,
        COUNT(CASE WHEN threat_type = 'COMPETITOR_PRICE_DROP' THEN 1 END) as stop_loss_triggers,
        COUNT(CASE WHEN threat_type = 'OZON_CARD_EROSION' THEN 1 END) as erosion_alerts,
        COUNT(CASE WHEN threat_type = 'MARGIN_BELOW_ZERO' THEN 1 END) as margin_alerts
      FROM sentinel_logs
      WHERE user_id = ${userId}
        AND created_at >= ${timeFilter.toISOString()}
    `;

    // 3. Scan for CURRENT threats (real-time)
    const productsResult = await sql`
      SELECT * FROM products 
      WHERE user_id = ${userId} 
        AND (is_monitored = true OR min_price > 0)
    `;
    const products = productsResult.rows;

    const activeThreats: Array<{
      productId: string;
      productTitle: string;
      marketplace: string;
      threatType: string;
      severity: string;
      message: string;
      currentPrice: number;
      minPrice: number;
      detectedAt: string;
    }> = [];

    // Get live prices and scan for threats
    const keys = await getMarketplaceKeys(userId);

    if (keys.wb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wbProducts = products.filter((p: any) => p.marketplace === 'WB');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nmIds = wbProducts.map((p: any) => p.nm_id).filter((id: any) => id !== null);

      if (nmIds.length > 0) {
        try {
          const { priceMap } = await fetchWbPrices(keys.wb, nmIds);

          for (const product of wbProducts) {
            if (!product.nm_id) continue;
            const livePrice = priceMap.get(product.nm_id);
            if (livePrice === undefined) continue;

            const scan = threatDetector.scanProductThreats(product as DBProduct, livePrice, 'WB');
            if (scan.hasThreats) {
              for (const threat of scan.threats) {
                activeThreats.push({
                  productId: product.product_id,
                  productTitle: product.title,
                  marketplace: 'WB',
                  threatType: threat.type,
                  severity: threat.severity,
                  message: threat.message,
                  currentPrice: livePrice,
                  minPrice: product.min_price || 0,
                  detectedAt: new Date().toISOString(),
                });
              }
            }
          }
        } catch (e) {
          console.error('[Sentinel Dashboard] WB scan failed:', e);
        }
      }
    }

    if (keys.ozon) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ozonProducts = products.filter((p: any) => p.marketplace === 'Ozon');
      const ozonIds = ozonProducts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => parseInt(p.product_id.replace('ozon-', '')))
        .filter(Boolean);

      if (ozonIds.length > 0) {
        try {
          const priceMap = await fetchOzonCurrentPrices(
            keys.ozon.clientId,
            keys.ozon.apiKey,
            ozonIds
          );

          for (const product of ozonProducts) {
            const ozonId = parseInt(product.product_id.replace('ozon-', ''));
            const livePrice = priceMap.get(ozonId);
            if (livePrice === undefined) continue;

            const scan = threatDetector.scanProductThreats(product as DBProduct, livePrice, 'Ozon');
            if (scan.hasThreats) {
              for (const threat of scan.threats) {
                activeThreats.push({
                  productId: product.product_id,
                  productTitle: product.title,
                  marketplace: 'Ozon',
                  threatType: threat.type,
                  severity: threat.severity,
                  message: threat.message,
                  currentPrice: livePrice,
                  minPrice: product.min_price || 0,
                  detectedAt: new Date().toISOString(),
                });
              }
            }
          }
        } catch (e) {
          console.error('[Sentinel Dashboard] Ozon scan failed:', e);
        }
      }
    }

    // 4. Calculate protection effectiveness
    const stats = statsResult.rows[0] || {};
    const successRate =
      stats.total_actions > 0
        ? Math.round((Number(stats.successful_actions) / Number(stats.total_actions)) * 100)
        : 100;

    return res.json({
      success: true,
      dashboard: {
        // Real-time threat status
        activeThreats: {
          count: activeThreats.length,
          critical: activeThreats.filter(t => t.severity === 'critical').length,
          warning: activeThreats.filter(t => t.severity === 'warning').length,
          items: activeThreats.slice(0, 20), // Limit to 20 for UI
        },

        // Defense history
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recentActions: actionsResult.rows.map((row: any) => ({
          id: row.id,
          productTitle: row.product_title,
          marketplace: row.marketplace,
          threatType: row.threat_type,
          action: row.defense_action,
          detectedPrice: row.detected_price,
          minPrice: row.min_price,
          savedAmount: row.saved_amount,
          success: row.success,
          createdAt: row.created_at,
        })),

        // Aggregated statistics
        stats: {
          timeRange,
          totalActions: Number(stats.total_actions) || 0,
          successfulActions: Number(stats.successful_actions) || 0,
          successRate,
          totalSaved: Math.round(Number(stats.total_saved) || 0),
          uniqueProductsProtected: Number(stats.unique_products_protected) || 0,
          threatBreakdown: {
            stopLossTriggers: Number(stats.stop_loss_triggers) || 0,
            erosionAlerts: Number(stats.erosion_alerts) || 0,
            marginAlerts: Number(stats.margin_alerts) || 0,
          },
        },

        // System status
        monitoredProducts: products.length,
        lastScanTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sentinel Dashboard Error:', error);
    return res.status(500).json({ error: 'Failed to fetch sentinel dashboard' });
  }
}
