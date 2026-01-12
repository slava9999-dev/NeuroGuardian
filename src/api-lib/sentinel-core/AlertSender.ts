import type { DBUser, DBProduct } from '../lib/types.js';
import { notificationService, sendAlert, type AlertUrgency } from '../services/notifications.js';
import type { Threat } from './ThreatDetector.js';

export class SentinelAlertSender {
  async sendReport(user: DBUser, message: string): Promise<void> {
    await notificationService.sendTelegramNotification(user.id, message);
  }

  async sendThreatAlert(
    user: DBUser,
    product: DBProduct,
    threat: Threat,
    marketplace: string
  ): Promise<void> {
    await sendAlert({
      type: 'sentinel_alert',
      urgency: threat.severity as AlertUrgency,
      product: {
        name: product.title,
        marketplace,
        externalId: product.nm_id ? String(product.nm_id) : product.product_id,
        userId: user.id,
      },
      message: threat.message,
      data: {
        livePrice: (threat.data as { livePrice?: number })?.livePrice || product.current_price,
      },
    });
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
}
