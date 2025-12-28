import { db } from '@/lib/db';

interface TelegramConfig {
  botToken: string;
  adminChatId: string;
  userChatIds: Map<number, string>;
}

interface Alert {
  type: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
  product?: any;
  analysis?: any;
  data?: any;
}

export class NotificationService {
  private config: TelegramConfig;
  private readonly TELEGRAM_API = 'https://api.telegram.org/bot';

  constructor() {
    this.config = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      adminChatId: process.env.ADMIN_CHAT_ID || '',
      userChatIds: new Map(),
    };
  }

  async sendAlert(alert: Alert): Promise<boolean> {
    if (!this.config.botToken) return false;

    const message = this.formatAlert(alert);

    if (alert.urgency === 'critical' || alert.urgency === 'high') {
      await this.sendToAdmin(message);
    }

    await this.logNotification(alert);

    // If associated with user product, send to user
    if (alert.product?.userId) {
      const userChatId = await this.getUserChatId(alert.product.userId);
      if (userChatId) {
        await this.sendMessage(userChatId, message);
      }
    }

    return true;
  }

  private formatAlert(alert: Alert): string {
    const urgencyEmoji = {
      low: 'ℹ️',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    };

    const emoji = urgencyEmoji[alert.urgency];

    if (alert.type === 'price_protection' && alert.analysis) {
      const a = alert.analysis;
      return [
        `${emoji} *Price Alert: ${a.product.name}*`,
        ``,
        `📍 Marketplace: ${a.product.marketplace}`,
        `💰 Current: ${a.currentPrice}₽`,
        `📊 Recommended: ${a.recommendedPrice}₽`,
        ``,
        `📝 Reason: ${a.reason}`,
        `🎯 Action: ${a.action}`,
      ].join('\n');
    }

    return `${emoji} *${alert.type}*\n\n${alert.message || JSON.stringify(alert.data, null, 2)}`;
  }

  async sendToAdmin(message: string): Promise<void> {
    await this.sendMessage(this.config.adminChatId, message);
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.TELEGRAM_API}${this.config.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Telegram error:', error);
      return false;
    }
  }

  private async getUserChatId(userId: number): Promise<string | null> {
    if (this.config.userChatIds.has(userId)) {
      return this.config.userChatIds.get(userId)!;
    }

    try {
      const result = await db.query('SELECT telegram_chat_id FROM users WHERE id = $1', [userId]);

      if (result.rows[0]?.telegram_chat_id) {
        this.config.userChatIds.set(userId, result.rows[0].telegram_chat_id);
        return result.rows[0].telegram_chat_id;
      }
    } catch (e) {
      // ignore db errors
    }

    return null;
  }

  private async logNotification(alert: Alert): Promise<void> {
    try {
      await db.query(
        `
        INSERT INTO ops_events (event_type, event_source, payload)
        VALUES ('notification_sent', 'notification_service', $1)
      `,
        [JSON.stringify(alert)]
      );
    } catch (e) {
      console.error('Failed to log notification', e);
    }
  }
}

export const notificationService = new NotificationService();
