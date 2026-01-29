import { sql } from '../api-lib/services/database.js';
import type { DBUser, DBProduct } from '../api-lib/lib/types.js';
import {
  notificationService,
  sendAlert,
  type AlertUrgency,
} from '../api-lib/services/notifications.js';
import type { Threat } from './ThreatDetector.js';
import { logger } from '../api-lib/lib/logger.js';

export class SentinelAlertSender {
  /**
   * BROADCAST: Finds all users who share the same shop credentials
   * and sends the report to all of them.
   */
  async sendReport(user: DBUser, message: string): Promise<void> {
    const teamMembers = await this.findTeamMembers(user);

    // Deduplicate to avoid spamming the same telegram ID multiple times
    const notifiedIds = new Set<number>();

    for (const member of teamMembers) {
      if (notifiedIds.has(member.id)) continue;

      try {
        // Use a generic alert type to ensure Viktor's persona and correct Markdown parsing
        await notificationService.sendAlertToUser(member.id, {
          type: 'sentinel_alert',
          urgency: 'low',
          message: message,
        });
        notifiedIds.add(member.id);
      } catch (err) {
        logger.warn(`Failed to send report to team member ${member.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async sendThreatAlert(
    user: DBUser,
    product: DBProduct,
    threat: Threat,
    marketplace: string
  ): Promise<void> {
    const teamMembers = await this.findTeamMembers(user);
    const notifiedIds = new Set<number>();

    // Map threat type to alert type
    const threatData = threat.data as {
      buyerPrice?: number;
      sellerPrice?: number;
      minPrice?: number;
      discountPercent?: number;
      isPromoActive?: boolean;
      livePrice?: number;
    };

    // Determine alert type based on threat type
    let alertType: 'promo_violation' | 'stoploss_breach' | 'sentinel_alert' | 'margin_warning' =
      'sentinel_alert';

    if (threat.type === 'promo_price_violation' || threat.type === 'flash_crash') {
      alertType = 'promo_violation';
    } else if (
      threat.type === 'buyer_price_below_stoploss' ||
      threat.type === 'competitor_price_drop'
    ) {
      alertType = 'stoploss_breach';
    } else if (threat.type === 'margin_below_zero') {
      alertType = 'margin_warning';
    }

    for (const member of teamMembers) {
      if (notifiedIds.has(member.id)) continue;

      try {
        await sendAlert({
          type: alertType,
          urgency: threat.severity as AlertUrgency,
          product: {
            name: product.title,
            marketplace,
            externalId: product.nm_id ? String(product.nm_id) : product.product_id,
            userId: member.id,
          },
          message: threat.message,
          data: {
            // For promo/stoploss alerts
            buyerPrice: threatData.buyerPrice || product.estimated_buyer_price || 0,
            sellerPrice: threatData.sellerPrice || product.current_price || 0,
            minPrice: threatData.minPrice || product.min_price || 0,
            discountPercent: threatData.discountPercent || 0,
            // Economics data for margin alerts
            profit: (threatData as any).profit || 0,
            margin: (threatData as any).margin || 0,
            // Legacy support
            livePrice: threatData.livePrice || product.current_price,
          },
        });
        notifiedIds.add(member.id);
      } catch (err) {
        logger.warn(`Failed to send threat alert to team member ${member.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async sendAdminSummary(message: string): Promise<void> {
    await notificationService.sendAlertToAdmin({ type: 'sentinel_alert', urgency: 'low', message });
  }

  async sendCriticalError(context: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = `🚨 **CRITICAL SENTINEL ERROR**\n\nContext: ${context}\nError: ${errorMessage}`;
    await notificationService.sendAlertToAdmin({
      type: 'sentinel_alert',
      urgency: 'critical',
      message,
    });
  }

  async sendAuthAlert(user: DBUser): Promise<void> {
    const message = `🔑 **ДОСТУП ОГРАНИЧЕН**\n\nВиктор обнаружил, что ваш API-ключ для одного из маркетплейсов больше недействителен (ошибка 401).\n\nЗащита временно приостановлена для этого аккаунта. Пожалуйста, обновите токен в настройках бота, чтобы я мог продолжить работу.`;
    await notificationService.sendAlertToUser(Number(user.id), {
      type: 'auth_error',
      urgency: 'high',
      message,
    });
  }

  /**
   * Generic alert sender from Orchestrator
   */
  async sendAlert(alert: import('../api-lib/services/notifications.js').Alert): Promise<void> {
    await notificationService.sendAlert(alert);
  }

  /**
   * Helper: Find other users who share API keys with this user
   */
  private async findTeamMembers(currentUser: DBUser): Promise<DBUser[]> {
    // If no keys, only return self
    if (!currentUser.api_key_wb && !currentUser.api_key_ozon) {
      return [currentUser];
    }

    try {
      // Find anyone matching EITHER WB key OR Ozon key
      const result = await sql`
        SELECT * FROM users 
        WHERE is_active = true 
        AND (
          (api_key_wb IS NOT NULL AND api_key_wb != '' AND api_key_wb = ${currentUser.api_key_wb})
          OR 
          (api_key_ozon IS NOT NULL AND api_key_ozon != '' AND api_key_ozon = ${currentUser.api_key_ozon})
          OR
          id = ${currentUser.id}
        )
      `;
      // Return unique users (just in case SQL returns duplicates although OR shouldn't if id is PK)
      return result.rows as DBUser[];
    } catch (e) {
      logger.error('Failed to find team members', e);
      return [currentUser]; // Fallback to safe default
    }
  }
}
