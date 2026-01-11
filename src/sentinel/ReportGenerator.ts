import type { DBUser } from '../api-lib/lib/types.js';
import type { UserCycleResult } from './types.js';

export class SentinelReportGenerator {
  generateUserReport(user: DBUser, userResult: UserCycleResult): string | null {
    const totalScanned = userResult.productsScanned.wb + userResult.productsScanned.ozon;
    if (totalScanned === 0) return null;

    const hasThreats = userResult.threatsDetected > 0;
    const hasActions = userResult.actionsTaken > 0;
    const hasErrors = userResult.errors.length > 0;
    const hasSomething = hasThreats || hasActions || hasErrors;

    const notificationsMode = user.notifications_mode || 'all';

    if (notificationsMode === 'threats_only' && !hasSomething) {
      return null;
    }

    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow',
    });

    let statusEmoji = '🟢',
      statusText = 'Всё в порядке';
    if (hasErrors) {
      statusEmoji = '🔴';
      statusText = 'Есть ошибки';
    } else if (hasActions) {
      statusEmoji = '⚔️';
      statusText = 'Защита сработала!';
    } else if (hasThreats) {
      statusEmoji = '🟡';
      statusText = 'Угрозы обнаружены';
    }

    const message = [
      `🛡️ *Отчёт по магазину*`,
      `⏰ ${time} (МСК)`,
      ``,
      `${statusEmoji} *${statusText}*`,
      ``,
      `📦 Проверено: ${totalScanned}`,
      hasThreats ? `⚠️ Угроз: ${userResult.threatsDetected}` : '',
      hasActions ? `⚔️ Защищено: ${userResult.actionsTaken}` : '',
      hasErrors ? `❌ Ошибок: ${userResult.errors.length}` : '',
      ``,
      `_Следующая проверка через 30 мин_`,
    ]
      .filter(Boolean)
      .join('\n');

    return message;
  }
}
