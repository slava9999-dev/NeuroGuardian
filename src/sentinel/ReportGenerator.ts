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

    // 1. HEADER & STATUS
    let headerEmoji = '🛡️';
    let statusHeader = 'Ваш магазин под защитой';
    let statusDetail = 'Угроз не обнаружено. Цены и остатки в норме.';

    if (hasErrors) {
      headerEmoji = '🚨';
      statusHeader = 'Требуется внимание';
      statusDetail = 'При проверке возникли ошибки подключения.';
    } else if (hasActions) {
      headerEmoji = '⚔️';
      statusHeader = 'Атака отражена';
      statusDetail = 'NeuroGuardian скорректировал цены для защиты выручки.';
    } else if (hasThreats) {
      headerEmoji = '⚠️';
      statusHeader = 'Обнаружены риски';
      statusDetail = 'Зафиксированы изменения у конкурентов или в рынке.';
    }

    const reportLines = [
      `${headerEmoji} *${statusHeader}*`,
      `🕒 ${time} (МСК)`,
      ``,
      `${statusDetail}`,
      ``,
      `*Мониторинг:*`,
      `📦 Всего товаров: ${totalScanned}`,
    ];

    if (userResult.productsScanned.wb > 0)
      reportLines.push(` • Wildberries: ${userResult.productsScanned.wb}`);
    if (userResult.productsScanned.ozon > 0)
      reportLines.push(` • Ozon: ${userResult.productsScanned.ozon}`);

    if (hasSomething) {
      reportLines.push(``);
      reportLines.push(`*События:*`);
      if (hasThreats) reportLines.push(`⚠️ Рисков: ${userResult.threatsDetected}`);
      if (hasActions) reportLines.push(`⚔️ Защищено: ${userResult.actionsTaken}`);
      if (hasErrors) reportLines.push(`❌ Ошибок: ${userResult.errors.length}`);
    }

    reportLines.push(``);
    reportLines.push(`_Следующая проверка через 30 мин_`);

    return reportLines.join('\n');
  }
}
