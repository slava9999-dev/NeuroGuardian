// ============================================
// NeuroGUARDIAN — Daily Report Cron Job
// Sends morning digest to all active users
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { sendAlertToUser } from '../../src/api-lib/services/notifications.js';
import type { Alert } from '../../src/api-lib/services/notifications.js';

/**
 * Daily Report - runs at 8:00 AM Moscow time (05:00 UTC)
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
    // Get all active users (subscription OR protection enabled)
    // NOTE: In our schema, users.id IS the Telegram user ID (BIGINT PRIMARY KEY)
    // There is NO separate telegram_id column
    const users = await sql`
      SELECT u.id, u.id as telegram_id, u.first_name
      FROM users u
      WHERE (u.subscription_active = true OR u.protection_enabled = true)
        AND u.is_active = true
    `;

    let sentCount = 0;
    let errorCount = 0;

    for (const user of users.rows) {
      try {
        // Get yesterday's stats for this user
        const stats = await sql`
          SELECT 
            COUNT(DISTINCT o.id) as orders_count,
            COALESCE(SUM(o.price_total), 0) as revenue,
            (SELECT COUNT(*) FROM products WHERE user_id = ${user.id}) as total_products,
            (SELECT COUNT(*) FROM products WHERE user_id = ${user.id} AND current_stock < 10 AND current_stock > 0) as low_stock_count,
            (SELECT COUNT(*) FROM products WHERE user_id = ${user.id} AND min_price > 0) as protected_count
          FROM marketplace_orders o
          WHERE o.user_id = ${user.id}
            AND o.order_date > NOW() - INTERVAL '24 hours'
        `;

        // Get Sentinel stats for past 24h
        const sentinelStats = await sql`
          SELECT 
            COUNT(*) as total_checks,
            COUNT(*) FILTER (WHERE success = true AND defense_action != 'notify') as defenses,
            COALESCE(SUM(saved_amount), 0) as total_saved
          FROM sentinel_logs 
          WHERE user_id = ${user.id}
            AND created_at > NOW() - INTERVAL '24 hours'
        `;

        const data = stats.rows[0];
        const sentinel = sentinelStats.rows[0];

        const ordersCount = parseInt(data.orders_count) || 0;
        const revenue = parseFloat(data.revenue) || 0;
        const totalProducts = parseInt(data.total_products) || 0;
        const lowStockCount = parseInt(data.low_stock_count) || 0;
        const protectedCount = parseInt(data.protected_count) || 0;
        const defenseActions = parseInt(sentinel.defenses) || 0;
        const totalSaved = parseFloat(sentinel.total_saved) || 0;

        // Build personalized digest message
        let message = `☀️ *Доброе утро, ${user.first_name || 'владелец магазина'}!*\n\n`;

        // === Yesterday's Results ===
        message += `📊 *Вчера:*\n`;
        if (ordersCount > 0) {
          message += `├─ 🛒 Заказов: *${ordersCount}*\n`;
          message += `├─ 💰 Выручка: *${revenue.toLocaleString('ru-RU')}₽*\n`;
        } else {
          message += `├─ 🛒 Заказов не было\n`;
        }

        // === Protection Status ===
        message += `\n🛡️ *Защита Sentinel:*\n`;
        message += `├─ 📦 Товаров: ${totalProducts} (защищено: ${protectedCount})\n`;

        if (defenseActions > 0) {
          message += `├─ ⚔️ Отражено атак: *${defenseActions}*\n`;
          if (totalSaved > 0) {
            message += `├─ 💵 Сохранено: *${totalSaved.toLocaleString('ru-RU')}₽*\n`;
          }
        } else {
          message += `├─ ✅ Угроз не обнаружено\n`;
        }
        message += `└─ 🔄 Мониторинг: 24/7 активен\n`;

        // === Warnings ===
        let hasProblems = false;

        if (lowStockCount > 0) {
          hasProblems = true;
          message += `\n⚠️ *Внимание:*\n`;
          message += `└─ 📉 Заканчивается: ${lowStockCount} товаров\n`;
        }

        if (protectedCount === 0 && totalProducts > 0) {
          hasProblems = true;
          message += `\n💡 *Рекомендация:*\n`;
          message += `└─ Установите минимальные цены для защиты!\n`;
        }

        // === Closing ===
        if (!hasProblems) {
          if (ordersCount > 0) {
            message += `\n✨ Отличный день! Так держать!`;
          } else {
            message += `\n💪 Sentinel на страже. Хорошего дня!`;
          }
        }

        // Send as daily_report alert
        const alert: Alert = {
          type: 'daily_report',
          urgency: hasProblems ? 'medium' : 'low',
          message,
        };

        const success = await sendAlertToUser(Number(user.id), alert);
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
