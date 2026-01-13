// ============================================
// NeuroGUARDIAN — n8n Webhook Handlers
// Endpoints for n8n workflow integration
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { runPriceProtection } from '../agent/price-protection.js';
import { getMarketplaceKeys } from '../services/marketplace-bridge.js';
import {
  fetchWbProductsResilient,
  fetchOzonProductsResilient,
} from '../services/resilient-marketplace.js';
import { logOpsEvent } from '../services/ops-logger.js';
import { notificationService } from '../services/notifications.js';
import { getAllUsers } from '../services/users.js';
import { saveProducts } from '../services/database.js';

// ============================================
// AUTHENTICATION
// ============================================

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET;

function validateN8nRequest(req: VercelRequest): boolean {
  if (!N8N_WEBHOOK_SECRET) {
    console.warn('N8N_WEBHOOK_SECRET not configured - n8n webhooks disabled');
    return false;
  }

  const secret =
    req.headers['x-n8n-secret'] || req.headers['authorization']?.replace('Bearer ', '');

  return secret === N8N_WEBHOOK_SECRET;
}

// ============================================
// HANDLERS
// ============================================

/**
 * POST /api?action=n8n-price-check
 * Triggers price protection check for all users
 */
export async function handleN8nPriceCheck(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!validateN8nRequest(req)) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid n8n secret' });
    return;
  }

  try {
    await logOpsEvent({
      eventType: 'n8n_webhook',
      eventSource: 'n8n',
      payload: { action: 'price-check', triggeredAt: new Date().toISOString() },
    });

    // Get all active users
    const users = await getAllUsers();

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      usersProcessed: 0,
      totalAnalyzed: 0,
      totalUpdated: 0,
      totalAlerts: 0,
      totalErrors: 0,
      details: [] as Array<{ userId: number; analyzed: number; updated: number; alerts: number }>,
    };

    for (const user of users) {
      try {
        const result = await runPriceProtection(user.id);
        results.usersProcessed++;
        results.totalAnalyzed += result.analyzed;
        results.totalUpdated += result.updated;
        results.totalAlerts += result.alerts;
        results.totalErrors += result.errors;
        results.details.push({
          userId: user.id,
          analyzed: result.analyzed,
          updated: result.updated,
          alerts: result.alerts,
        });
      } catch (error) {
        results.totalErrors++;
        console.error(`Price check failed for user ${user.id}:`, error);
      }
    }

    // Send hourly report if there were any changes
    if (results.totalUpdated > 0 || results.totalAlerts > 0 || results.totalErrors > 0) {
      await notificationService.sendHourlyReport({
        productsSynced: 0,
        priceChecks: results.totalAnalyzed,
        autoUpdates: results.totalUpdated,
        alertsSent: results.totalAlerts,
        errors: results.totalErrors > 0 ? [`${results.totalErrors} errors occurred`] : undefined,
      });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('n8n price check failed:', error);

    await notificationService.sendAlertToAdmin({
      type: 'system_error',
      urgency: 'high',
      message: `Price check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api?action=n8n-sync-products
 * Syncs products from marketplaces to database
 */
export async function handleN8nSyncProducts(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!validateN8nRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await logOpsEvent({
      eventType: 'n8n_webhook',
      eventSource: 'n8n',
      payload: { action: 'sync-products', triggeredAt: new Date().toISOString() },
    });

    const users = await getAllUsers();

    let totalSynced = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const keys = await getMarketplaceKeys(user.id);

        // Sync WB products
        if (keys.wb) {
          // Check if key looks encrypted (failed decryption)
          if (keys.wb.includes(':') && keys.wb.length > 60) {
            errors.push(
              `WB System Error: API Key decryption failed (Check ENCRYPTION_KEY env var)`
            );
          } else {
            try {
              const result = await fetchWbProductsResilient(keys.wb);

              if (result.success && result.data) {
                const wbProducts = result.data;
                const productsToSave = wbProducts.map(p => ({
                  product_id: p.product_id,
                  nm_id: p.nm_id,
                  title: p.title,
                  current_price: p.current_price,
                  current_stock: p.current_stock,
                  image_url: p.image_url,
                  marketplace: 'WB' as const,
                }));

                if (productsToSave.length > 0) {
                  await saveProducts(user.id, productsToSave);
                  totalSynced += wbProducts.length;
                } else {
                  errors.push(
                    `WB Warning: 0 products found for user ${user.id} (Check API Permissions)`
                  );
                }

                if (result.fromFallback) {
                  errors.push(`WB sync for user ${user.id}: used cached data (API unavailable)`);
                }
              } else {
                errors.push(`WB sync failed for user ${user.id}: ${result.error || 'No data'}`);
              }
            } catch (error) {
              errors.push(
                `WB sync failed for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown'}`
              );
            }
          }
        }

        // Sync Ozon products
        if (keys.ozon?.clientId && keys.ozon?.apiKey) {
          // Check if keys look encrypted
          if (keys.ozon.apiKey.includes(':') && keys.ozon.apiKey.length > 60) {
            errors.push(`Ozon System Error: API Key decryption failed`);
          } else {
            try {
              const result = await fetchOzonProductsResilient(keys.ozon.clientId, keys.ozon.apiKey);

              if (result.success && result.data) {
                const ozonProducts = result.data;
                const productsToSave = ozonProducts.map(p => ({
                  product_id: p.product_id,
                  offer_id: p.product_id.replace('ozon-', ''), // Fix: offer_id should be without prefix
                  title: p.title,
                  current_price: p.current_price,
                  current_stock: p.current_stock,
                  image_url: p.image_url,
                  marketplace: 'Ozon' as const,
                }));

                if (productsToSave.length > 0) {
                  await saveProducts(user.id, productsToSave);
                  totalSynced += ozonProducts.length;
                } else {
                  errors.push(
                    `Ozon Warning: 0 products found for user ${user.id} (Check API Permissions)`
                  );
                }

                if (result.fromFallback) {
                  errors.push(`Ozon sync for user ${user.id}: used cached data (API unavailable)`);
                }
              } else {
                errors.push(`Ozon sync failed for user ${user.id}: ${result.error || 'No data'}`);
              }
            } catch (error) {
              errors.push(
                `Ozon sync failed for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown'}`
              );
            }
          }
        }
      } catch (error) {
        errors.push(
          `User ${user.id} sync failed: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    await logOpsEvent({
      eventType: 'sync_completed',
      eventSource: 'n8n',
      payload: { totalSynced, errors: errors.length },
    });

    res.status(200).json({
      success: true,
      synced: totalSynced,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('n8n sync products failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api?action=n8n-health
 * Health check endpoint for n8n
 */
export async function handleN8nHealth(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!validateN8nRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const health = {
    status: 'ok' as 'ok' | 'degraded' | 'down',
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      n8n_secret: !!N8N_WEBHOOK_SECRET,
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      admin_chat: !!process.env.ADMIN_CHAT_ID,
    },
  };

  // Check database
  try {
    await sql`SELECT 1`;
    health.checks.database = true;
  } catch {
    health.status = 'degraded';
  }

  // Determine overall status
  if (!health.checks.database) {
    health.status = 'down';
  } else if (!health.checks.telegram || !health.checks.admin_chat) {
    health.status = 'degraded';
  }

  res.status(health.status === 'down' ? 503 : 200).json(health);
}

/**
 * POST /api?action=n8n-send-report
 * Sends a custom report via Telegram
 */
export async function handleN8nSendReport(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!validateN8nRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { reportType, data } = req.body || {};

  try {
    if (reportType === 'hourly') {
      await notificationService.sendHourlyReport({
        productsSynced: data?.productsSynced || 0,
        priceChecks: data?.priceChecks || 0,
        autoUpdates: data?.autoUpdates || 0,
        alertsSent: data?.alertsSent || 0,
        errors: data?.errors,
      });
    } else if (reportType === 'daily') {
      await notificationService.sendDailyReport({
        totalProducts: data?.totalProducts || 0,
        totalPriceChanges: data?.totalPriceChanges || 0,
        totalAlerts: data?.totalAlerts || 0,
        totalErrors: data?.totalErrors || 0,
        topProducts: data?.topProducts,
      });
    } else if (reportType === 'custom') {
      await notificationService.sendAlertToAdmin({
        type: 'system_error',
        urgency: 'low',
        message: data?.message || 'Custom report',
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('n8n send report failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api?action=n8n-get-stats
 * Returns system statistics for n8n dashboards
 */
export async function handleN8nGetStats(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!validateN8nRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Get various statistics using sql template literals
    const usersResult = await sql`SELECT COUNT(*) as count FROM users`;
    const productsResult = await sql`SELECT COUNT(*) as count FROM products`;

    let eventsResult: { rows: Array<{ event_type: string; count: string }> } = { rows: [] };
    try {
      const result = await sql`
        SELECT event_type, COUNT(*) as count 
        FROM ops_events 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY event_type
      `;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventsResult = result as any;
    } catch {
      // Table might not exist yet
    }

    let rulesResult: { rows: Array<{ count: string }> } = { rows: [{ count: '0' }] };
    try {
      const result = await sql`SELECT COUNT(*) as count FROM price_rules WHERE active = true`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rulesResult = result as any;
    } catch {
      // Table might not exist yet
    }

    const eventStats: Record<string, number> = {};
    for (const row of eventsResult.rows) {
      eventStats[row.event_type] = parseInt(row.count);
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalUsers: parseInt(usersResult.rows[0]?.count || '0'),
        totalProducts: parseInt(productsResult.rows[0]?.count || '0'),
        activePriceRules: parseInt(rulesResult.rows[0]?.count || '0'),
        eventsLast24h: eventStats,
      },
    });
  } catch (error) {
    console.error('n8n get stats failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
