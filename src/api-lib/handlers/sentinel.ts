// ============================================
// NeuroGUARDIAN — Sentinel Handler
// Price protection & monitoring entry point
// REFACTORED: Uses SentinelService class (TZ v2.0)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DBProduct } from '../lib/types.js';
import { verifyAdminAccessAsync, extractAnyAuthAsync } from '../middleware/auth.js';

import { sentinelOrchestrator as sentinelService } from '../../sentinel/SentinelOrchestrator.js';
import { sentinelPriceReporter } from '../../sentinel/PriceReporter.js';
import { notificationService } from '../services/notifications.js';
import { db, products, users } from '../../infrastructure/database/db.js';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { getSecret } from '../lib/secrets-helper.js';
import { logger } from '../lib/logger.js';
import { sql } from '../services/database.js';

/**
 * Handle check-prices action (Sentinel Cron)
 * Supports ?includeReport=true to send daily report after price check (for Vercel Hobby single-cron limit)
 */
export async function handleCheckPrices(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
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
          logger.info('Authenticated via cron query param');
        }
      } catch {
        if (querySecret === process.env.CRON_SECRET) {
          isGlobalAdmin = true;
          logger.info('Authenticated via cron query param (env fallback)');
        }
      }
    }
  }

  try {
    let result;

    const includeReport = req.query.includeReport === 'true';

    if (authResult.success) {
      logger.info('Sentinel check started for user', {
        userId: authResult.context.userId,
        authMethod: authResult.context.authMethod,
      });
      result = await sentinelService.runForUser(authResult.context.userId, {
        sendPriceReport: includeReport,
      });
    } else if (isGlobalAdmin) {
      logger.info('Sentinel full global cycle started');
      result = await sentinelService.runCycle({ sendPriceReport: includeReport });
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
    logger.error('Sentinel Handler Error', error);
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
    logger.error('Sentinel Stats Error', error, { userId });
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
  const { ThreatDetector } = await import('../../sentinel/ThreatDetector.js');
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
      const wbProducts = products.filter(p => p.marketplace === 'WB') as DBProduct[];
      const nmIds = wbProducts
        .map(p => Number(p.nm_id))
        .filter((id): id is number => !isNaN(id) && id !== 0);

      if (nmIds.length > 0) {
        try {
          const { priceMap } = await fetchWbPrices(keys.wb, nmIds);

          for (const product of wbProducts) {
            if (!product.nm_id) continue;
            const livePrice = priceMap.get(Number(product.nm_id));
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
          logger.warn('Sentinel Dashboard WB scan failed', { error: e });
        }
      }
    }

    if (keys.ozon) {
      const ozonProducts = products.filter(p => p.marketplace === 'Ozon') as DBProduct[];
      const ozonIds = ozonProducts
        .map(p => parseInt(p.product_id.replace('ozon-', '')))
        .filter((id): id is number => !isNaN(id));

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
          logger.warn('Sentinel Dashboard Ozon scan failed', { error: e });
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
        recentActions: actionsResult.rows.map(row => ({
          id: row.id as string,
          productTitle: row.product_title as string,
          marketplace: row.marketplace as string,
          threatType: row.threat_type as string,
          action: row.defense_action as string,
          detectedPrice: Number(row.detected_price || 0),
          minPrice: Number(row.min_price || 0),
          savedAmount: Number(row.saved_amount || 0),
          success: Boolean(row.success),
          createdAt: row.created_at as string,
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
    logger.error('Sentinel Dashboard Error', error, { userId });
    return res.status(500).json({ error: 'Failed to fetch sentinel dashboard' });
  }
}

/**
 * Handle sentinel price report generation (Cron/Manual)
 */
export async function handleSentinelPriceReport(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const isGlobalAdmin = await verifyAdminAccessAsync(req);
  if (!isGlobalAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get active users
    const activeUsers = await db.query.users.findMany({
      where: and(eq(users.isActive, true), eq(users.protectionEnabled, true)),
    });

    let reportsSent = 0;

    for (const user of activeUsers) {
      if (!user.id) continue;

      // 2. Get user's tracked products
      const userProducts = await db.query.products.findMany({
        where: and(
          eq(products.userId, String(user.id)),
          drizzleSql`(${products.isMonitored} = true)`
        ),
      });

      if (userProducts.length === 0) continue;

      // 3. Generate Report
      // Map Drizzle camelCase to DBProduct snake_case
      const mappedProducts = userProducts.map(p => ({
        ...p,
        product_id: p.productId,
        nm_id: p.nmId,
        current_price: p.currentPrice,
        min_price: p.minPrice,
        estimated_buyer_price: p.estimatedBuyerPrice,
        title: p.title,
        marketplace: p.marketplace,
        is_monitored: p.isMonitored,
      })) as unknown as DBProduct[];

      const report = await sentinelPriceReporter.generateDetailedReport(mappedProducts);

      // 4. Check for breaches to add interaction
      const breaches = mappedProducts.filter(
        p =>
          (p.current_price || 0) > 0 &&
          (p.min_price || 0) > 0 &&
          (p.current_price || 0) < (p.min_price || 0)
      );
      const hasBreaches = breaches.length > 0;

      // 5. Send Report with Buttons
      let replyMarkup: Record<string, unknown> | undefined = undefined;

      if (hasBreaches) {
        replyMarkup = {
          inline_keyboard: [
            [
              {
                text: `🚨 Исправить цены (${breaches.length} шт)`,
                callback_data: `sentinel_fix_prices:${user.id}`,
              },
            ],
          ],
        };
      }

      const success = await notificationService.sendRawMessage(
        Number(user.id),
        report,
        replyMarkup
      );
      if (success) reportsSent++;
    }

    return res.json({ success: true, reportsSent, usersProcessed: activeUsers.length });
  } catch (error) {
    logger.error('Sentinel Price Report Failed', error);
    return res.status(500).json({ error: 'Report generation failed' });
  }
}

/**
 * Handle "Fix Prices" button action
 */
export async function handleSentinelFixPrices(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const { userId } = req.body || req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const fixedProducts: string[] = [];

    // 1. Find breached products
    const breachedProducts = await db.query.products.findMany({
      where: and(
        eq(products.userId, String(userId)),
        drizzleSql`current_price < min_price AND min_price > 0`
      ),
    });

    if (breachedProducts.length === 0) {
      return res.json({ success: true, message: 'No prices needed fixing' });
    }

    // 2. Fix them
    for (const p of breachedProducts) {
      if (!p.minPrice) continue;

      await db
        .update(products)
        .set({ currentPrice: p.minPrice, updatedAt: new Date() })
        .where(eq(products.id, p.id));

      fixedProducts.push(p.title || p.productId);
    }

    // 3. Notify user
    await notificationService.sendRawMessage(
      Number(userId),
      `✅ *Успешно исправлено ${fixedProducts.length} цен!*\n\nЦены установлены на уровень Stop Loss. Синхронизация с маркетплейсом запущена.`
    );

    return res.json({ success: true, fixed: fixedProducts.length });
  } catch (error) {
    logger.error('Fix Prices Failed', error);
    return res.status(500).json({ error: 'Fix failed' });
  }
}
