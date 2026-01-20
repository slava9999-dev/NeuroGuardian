import type { DBUser } from '../api-lib/lib/types.js';
import type { UserCycleResult } from './types.js';

/**
 * Premium Sentinel Report Generator
 * Creates beautiful, informative Telegram status reports
 */
export class SentinelReportGenerator {
  generateUserReport(user: DBUser, userResult: UserCycleResult): string | null {
    const totalScanned = userResult.productsScanned.wb + userResult.productsScanned.ozon;
    if (totalScanned === 0) return null;

    const hasThreats = userResult.threatsDetected > 0;
    const hasActions = userResult.actionsTaken > 0;
    const hasErrors = userResult.errors.length > 0;
    const hasSomething = hasThreats || hasActions || hasErrors;

    const notificationsMode = user.notifications_mode || 'all';

    // Skip if threats_only mode and nothing happened
    if (notificationsMode === 'threats_only' && !hasSomething) {
      return null;
    }

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    // ═══════════════════════════════════════
    // STATUS DETERMINATION
    // ═══════════════════════════════════════
    type ReportStatus = 'ok' | 'defended' | 'warning' | 'error';
    let status: ReportStatus = 'ok';
    let headerEmoji = '✅';
    let statusText = 'Всё под контролем';
    let statusDetail = 'Угроз не обнаружено';

    if (hasErrors) {
      status = 'error';
      headerEmoji = '🚨';
      statusText = 'Требует внимания';
      statusDetail = 'Ошибки при проверке';
    } else if (hasActions) {
      status = 'defended';
      headerEmoji = '⚔️';
      statusText = 'Атака отражена';
      statusDetail = `Защищено ${userResult.actionsTaken} ${this.pluralize(userResult.actionsTaken, 'товар', 'товара', 'товаров')}`;
    } else if (hasThreats) {
      status = 'warning';
      headerEmoji = '⚠️';
      statusText = 'Обнаружены риски';
      statusDetail = `${userResult.threatsDetected} ${this.pluralize(userResult.threatsDetected, 'угроза', 'угрозы', 'угроз')}`;
    }

    // ═══════════════════════════════════════
    // VISUAL STATUS BAR
    // ═══════════════════════════════════════
    const statusBar = this.generateStatusBar(status);

    // ═══════════════════════════════════════
    // BUILD REPORT
    // ═══════════════════════════════════════
    const lines: string[] = [];

    // Header
    lines.push(`🤖 *Sentinel*`);
    lines.push(``);
    lines.push(`${headerEmoji} *${statusText}*`);
    lines.push(`🕒 ${time} (МСК)`);
    lines.push(``);

    // Visual status bar
    lines.push(statusBar);
    lines.push(``);

    // Status details box
    lines.push(`┌─────────────────────────`);
    lines.push(`│ 📊 *Статус:* ${statusDetail}`);
    lines.push(`│`);
    lines.push(`│ 📦 *Товаров:* ${totalScanned}`);

    // Marketplace breakdown
    if (userResult.productsScanned.wb > 0 && userResult.productsScanned.ozon > 0) {
      lines.push(
        `│    🟣 WB: ${userResult.productsScanned.wb}  🔵 Ozon: ${userResult.productsScanned.ozon}`
      );
    } else if (userResult.productsScanned.wb > 0) {
      lines.push(`│    🟣 Wildberries: ${userResult.productsScanned.wb}`);
    } else if (userResult.productsScanned.ozon > 0) {
      lines.push(`│    🔵 Ozon: ${userResult.productsScanned.ozon}`);
    }

    lines.push(`└─────────────────────────`);

    // Events section (only if something happened)
    if (hasSomething) {
      lines.push(``);
      lines.push(`📋 *События:*`);

      if (hasActions) {
        lines.push(`   ⚔️ Защищено: ${userResult.actionsTaken} цен`);
      }
      if (hasThreats) {
        lines.push(`   ⚠️ Рисков: ${userResult.threatsDetected}`);
      }
      if (hasErrors) {
        lines.push(`   ❌ Ошибок: ${userResult.errors.length}`);
        // Show first error briefly
        if (userResult.errors[0]) {
          const shortError =
            userResult.errors[0].length > 40
              ? userResult.errors[0].substring(0, 37) + '...'
              : userResult.errors[0];
          lines.push(`   └ _${shortError}_`);
        }
      }
    }

    // Footer
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);

    // Motivational message based on status
    const motivation = this.getMotivation(status, hasActions ? userResult.actionsTaken : 0);
    lines.push(motivation);

    return lines.join('\n');
  }

  /**
   * Generate visual status bar
   */
  private generateStatusBar(status: 'ok' | 'defended' | 'warning' | 'error'): string {
    switch (status) {
      case 'ok':
        return `🟢🟢🟢🟢🟢 *100%* Защита активна`;
      case 'defended':
        return `🟢🟢🟢🟢⚔️ *100%* Атака отбита!`;
      case 'warning':
        return `🟡🟡🟡🟠🔴 *60%* Есть риски`;
      case 'error':
        return `🔴🔴🔴🔴🔴 *0%* Требуется действие`;
    }
  }

  /**
   * Get motivational message based on status
   */
  private getMotivation(
    status: 'ok' | 'defended' | 'warning' | 'error',
    actionsCount: number
  ): string {
    switch (status) {
      case 'ok': {
        const okMessages = [
          `💪 Продолжайте в том же духе!`,
          `🌟 Отличная работа, всё стабильно!`,
          `✨ Ваш бизнес под надёжной защитой`,
          `🚀 Всё идёт по плану!`,
        ];
        return okMessages[Math.floor(Math.random() * okMessages.length)];
      }

      case 'defended':
        return `💰 Сэкономлено: ~${actionsCount * 150}₽+ (защита маржи)`;

      case 'warning':
        return `👀 _Рекомендуем проверить товары_`;

      case 'error':
        return `⚙️ _Проверьте настройки API-ключей_`;
    }
  }

  /**
   * Russian pluralization helper
   */
  private pluralize(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;

    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }
}
