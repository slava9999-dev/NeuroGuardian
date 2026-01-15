// ============================================
// NeuroGUARDIAN — Cron: Subscription Check
// Freezes accounts with expired subscriptions
// ============================================

import { sql } from '../src/api-lib/services/database.js';
import { notificationService } from '../src/api-lib/services/notifications.js';
import { logger } from '../src/api-lib/lib/logger.js';

async function checkSubscriptions() {
  logger.info('[Cron] Starting subscription expiration check...');

  try {
    // 1. Identify users with expired subscriptions that are still active
    const expiredUsers = await sql`
      SELECT u.id, u.first_name, u.subscription_end
      FROM users u
      WHERE u.is_active = true 
      AND u.subscription_active = true
      AND u.subscription_end < NOW()
    `;

    logger.info(`[Cron] Found ${expiredUsers.rows.length} expired subscriptions`);

    for (const user of expiredUsers.rows) {
      const userId = parseInt(user.id);

      // 2. Freeze account
      await sql`
        UPDATE users 
        SET is_active = false, 
            subscription_active = false,
            updated_at = NOW() 
        WHERE id = ${userId}
      `;

      // 3. Notify user
      await notificationService.sendAlertToUser(userId, {
        type: 'subscription_expired',
        urgency: 'high',
        message: `🚨 Внимание! Срок действия вашей подписки истек. 
        Доступ к функциям NeuroGUARDIAN (Защита цен, Vision) временно приостановлен.
        
        Продлите подписку в Личном Кабинете, чтобы продолжить работу.`,
      });

      logger.info(`[Cron] User ${userId} frozen due to subscription expiration`);
    }

    logger.info('[Cron] Subscription check completed successfully');
  } catch (error) {
    logger.error('[Cron] Subscription check failed', { error });
    process.exit(1);
  }
}

// Execute
checkSubscriptions().then(() => process.exit(0));
