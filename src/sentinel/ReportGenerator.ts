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
    let statusText = 'БЕЗОПАСНОСТЬ ПРИБЫЛИ: ОК';
    let statusDetail = 'Маржа под контролем';

    if (hasErrors) {
      status = 'error';
      headerEmoji = '🚨';
      statusText = 'ТРЕБУЕТСЯ ВНИМАНИЕ';
      statusDetail = 'Сбой мониторинга';
    } else if (hasActions) {
      status = 'defended';
      headerEmoji = '🛡️';
      statusText = 'АТАКА ОТРАЖЕНА';
      statusDetail = `Защищено ${userResult.actionsTaken} ${this.pluralize(userResult.actionsTaken, 'позиция', 'позиции', 'позиций')}`;
    } else if (hasThreats) {
      status = 'warning';
      headerEmoji = '⚠️';
      statusText = 'ОБНАРУЖЕНЫ РИСКИ';
      statusDetail = `${userResult.threatsDetected} ${this.pluralize(userResult.threatsDetected, 'угроза марже', 'угрозы марже', 'угроз марже')}`;
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
    lines.push(`🤖 *Виктор ИИ | Сводка защиты*`);
    lines.push(``);
    lines.push(`${headerEmoji} *${statusText}*`);
    lines.push(`🕒 ${time} (МСК)`);
    lines.push(``);

    // Visual status bar
    lines.push(statusBar);
    lines.push(``);

    // Context summary
    lines.push(`┌── *ОПЕРАЦИОННЫЙ СТАТУС*`);
    lines.push(`│ 📊 *Итог:* ${statusDetail}`);
    lines.push(`│ 📦 *В работе:* ${totalScanned} SKU`);

    // Marketplace breakdown
    if (userResult.productsScanned.wb > 0 && userResult.productsScanned.ozon > 0) {
      lines.push(
        `│    🟣 WB: ${userResult.productsScanned.wb}  🔵 Ozon: ${userResult.productsScanned.ozon}`
      );
    }

    lines.push(`└─────────────────────────`);

    // Impact section (Financial Risk)
    if (hasThreats || hasActions) {
      const estimatedRisk = userResult.threatsDetected * 450; // Heuristic: avg damage per threat
      const savedProfit = userResult.actionsTaken * 280; // Heuristic: avg saved margin

      lines.push(``);
      lines.push(`💰 *ФИНАНСОВЫЙ АНАЛИЗ:*`);
      if (hasActions) {
        lines.push(`   💸 Сохранено прибыли: ~${savedProfit.toLocaleString('ru-RU')}₽`);
      }
      if (hasThreats) {
        lines.push(`   ⚠️ Риск потерь: ~${estimatedRisk.toLocaleString('ru-RU')}₽ / час`);
      }
    }

    // Events section
    if (hasSomething) {
      lines.push(``);
      lines.push(`📝 *ДЕТАЛИ ПРОТОКОЛА:*`);

      if (hasActions) {
        lines.push(`   🛡️ Авто-защита: ${userResult.actionsTaken} испр.`);
      }
      if (hasThreats) {
        lines.push(`   🔎 Обнаружено аномалий: ${userResult.threatsDetected}`);
      }
      if (hasErrors) {
        lines.push(`   ❌ Ошибки API: ${userResult.errors.length}`);
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
        return `✅ 🟦🟦🟦🟦🟦 *100%* Безопасно`;
      case 'defended':
        return `🛡️ 🟦🟦🟦🟦🟧 *95%* Атака отбита`;
      case 'warning':
        return `⚠️ 🟧🟧🟧⬜⬜ *60%* Средний риск`;
      case 'error':
        return `🚨 🟥⬜⬜⬜⬜ *10%* Критичный сбой`;
    }
  }

  /**
   * Get motivational message based on status
   */
  private getMotivation(
    status: 'ok' | 'defended' | 'warning' | 'error',
    _actionsCount: number
  ): string {
    switch (status) {
      case 'ok': {
        const okMessages = [
          `💡 Все цены соответствуют вашей стратегии.`,
          `🌟 Система в режиме ожидания аномалий.`,
          `✨ Ваша маржа под защитой Виктора 24/7.`,
          `🚀 Полет нормальный. Продажи идут по плану.`,
        ];
        return okMessages[Math.floor(Math.random() * okMessages.length)];
      }

      case 'defended':
        return `✅ *Система успешно скорректировала цены для защиты вашей прибыли.*`;

      case 'warning':
        return `🧐 *Внимание:* Обнаружены отклонения от стоп-лосса. Проверьте список ниже.`;

      case 'error':
        return `⚙️ *Действие:* Переподключите API-ключи в настройках для продолжения защиты.`;
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
