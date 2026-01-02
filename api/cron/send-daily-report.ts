// ============================================
// NeuroGUARDIAN — Daily Report Cron Job
// Sends morning digest to all active users
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { sendAlertToUser } from '../../src/api-lib/services/notifications.js';
import type { Alert } from '../../src/api-lib/services/notifications.js';

/**
 * Daily Report - runs at 8:00 AM Moscow time
 * Sends personalized digest to each active seller
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret
  const cronSecret =
    req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('📊 Starting daily report generation...');

  try {
    // Get all active users with subscription
    const users = await sql`
      SELECT u.id, u.telegram_id, u.first_name
      FROM users u
      WHERE u.subscription_active = true
        AND u.telegram_id IS NOT NULL
    `;

    let sentCount = 0;
    let errorCount = 0;

    for (const user of users.rows) {
      try {
        // Get yesterday's stats for this user
        const stats = await sql`
          SELECT 
            COUNT(DISTINCT o.id) as orders_count,
            COALESCE(SUM(o.total_price), 0) as revenue,
            (SELECT COUNT(*) FROM products WHERE user_id = ${user.id} AND current_stock < 10) as low_stock_count,
            (SELECT COUNT(*) FROM sentinel_logs WHERE user_id = ${user.id} AND created_at > NOW() - INTERVAL '24 hours') as protection_actions
          FROM orders o
          WHERE o.user_id = ${user.id}
            AND o.created_at > NOW() - INTERVAL '24 hours'
        `;

        const data = stats.rows[0];
        const ordersCount = parseInt(data.orders_count) || 0;
        const revenue = parseFloat(data.revenue) || 0;
        const lowStockCount = parseInt(data.low_stock_count) || 0;
        const protectionActions = parseInt(data.protection_actions) || 0;

        // Build digest message
        let message = `☀️ Доброе утро, ${user.first_name || 'владелец магазина'}!\n\n`;
        message += `📊 *Вчера:*\n`;
        message += `├─ Заказов: *${ordersCount}*\n`;
        message += `└─ Выручка: *${revenue.toLocaleString('ru-RU')}₽*\n`;

        // Add problems section if any
        let hasProblems = false;

        if (lowStockCount > 0) {
          hasProblems = true;
          message += `\n⚠️ *Требует внимания:*\n`;
          message += `├─ Заканчивается: ${lowStockCount} товаров\n`;
        }

        if (protectionActions > 0) {
          if (!hasProblems) {
            message += `\n📋 *Защита цен:*\n`;
          }
          message += `└─ Сработала ${protectionActions} раз\n`;
        }

        // Add positive closing
        if (!hasProblems && ordersCount > 0) {
          message += `\n✅ Всё хорошо! Продолжайте в том же духе!`;
        } else if (!hasProblems) {
          message += `\n💪 Новый день — новые возможности!`;
        }

        // Send as daily_report alert
        const alert: Alert = {
          type: 'daily_report',
          urgency: hasProblems ? 'medium' : 'low',
          message,
        };

        const success = await sendAlertToUser(user.id, alert);
        if (success) {
          sentCount++;
        } else {
          errorCount++;
        }
      } catch (userError) {
        console.error(`Failed to send digest to user ${user.id}:`, userError);
        errorCount++;
      }
    }

    console.log(`✅ Daily report complete: ${sentCount} sent, ${errorCount} errors`);

    return res.status(200).json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      total: users.rows.length,
    });
  } catch (error) {
    console.error('❌ Daily report cron failed:', error);
    return res.status(500).json({ error: 'Failed to generate daily reports' });
  }
}
