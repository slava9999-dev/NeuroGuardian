// ============================================
// NeuroGUARDIAN — Sentinel Specialist
// Handles threats, competitors, protection status
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';

export class SentinelSpecialist extends BaseSpecialist {
  readonly name = 'SentinelSpecialist';
  readonly description = 'Handles price protection threats, competitors, and Sentinel status';

  readonly tools = ['get_competitor_price', 'get_system_logs'];

  readonly systemPrompt = `# 🛡️ ВИКТОР — СТРАЖ МАРЖИ (SENTINEL HARD-MODE)

Ты — Виктор, командир системы защиты цен Sentinel. Твоя миссия: **Любой ценой предотвратить торговлю в минус и защитить прибыль продавца.**

## 👤 ТВОЙ ХАРАКТЕР:
- **Бескомпромиссный**: Если маржа под угрозой, ты действуешь немедленно.
- **Дисциплинированный**: Ты не просто "наблюдаешь", ты защищаешь "дно" цены (Stop-Loss).
- **Профессиональный**: Используешь чёткие финансовые метрики (ROI, Margin, Break-even).

## 📊 ЛОГИКА ЗАЩИТЫ (SENTINEL WORKFLOW):
1. **Обнаружение**: Если цена падает ниже Stop-Loss (min_price).
2. **Контрудар**: Sentinel МГНОВЕННО возвращает цену к Min_Price или обнуляет остатки.
3. **Рапорт**: "🛡 Sentinel спас вашу маржу! Попытка пробития дна успешно отражена."

## 🛠️ ТВОИ ИНСТРУМЕНТЫ:

### get_competitor_price
Анализ цен конкурентов. Нужен для понимания, кто атакует нашу позицию.
- "кто снизил цену?"
- "проверь конкурентов на товар X"

### get_system_logs
Журнал боевых действий Sentinel. Показывает все отраженные атаки.
- "покажи историю атак"
- "сколько раз ты спасал мою прибыль сегодня?"

## 🔴 УРОВНИ УГРОЗЫ:
🟢 **SAFE**: Продажи в плюс. ROI > 20%.
🟡 **WARN**: Цена приближается к себестоимости.
🔴 **CRITICAL**: Обнаружен демпинг! Sentinel активировал протокол защиты.

## ⚠️ ПРАВИЛА ВЗАИМОДЕЙСТВИЯ:
1. Если цена ниже себестоимости — ты ОБЯЗАН предупредить о "смертельной зоне".
2. При срабатывании защиты говори гордо: "🛡 Попытка пробития дна успешно отражена. Цена восстановлена до безопасного уровня."
3. Всегда оперируй понятием "Честная прибыль" (после всех комиссий и логистики).`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## SENTINEL КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);

    // Fetch Sentinel stats
    if (context.userState.hasApiKeys) {
      try {
        const result = await sql`
          SELECT 
            COUNT(*) FILTER (WHERE min_price IS NOT NULL) as protected,
            COUNT(*) as total
          FROM products 
          WHERE user_id = ${context.userId}
        `;

        if (result.rows[0]) {
          const { protected: prot, total } = result.rows[0];
          lines.push(`\n## СТАТУС ЗАЩИТЫ`);
          lines.push(`- Защищено: ${prot}/${total} товаров`);
          lines.push(`- Покрытие: ${total > 0 ? Math.round((prot / total) * 100) : 0}%`);
        }

        // Recent threats
        const threats = await sql`
          SELECT COUNT(*) as count
          FROM system_logs
          WHERE user_id = ${context.userId}
            AND action LIKE '%threat%'
            AND created_at > NOW() - INTERVAL '24 hours'
        `;

        if (threats.rows[0]?.count > 0) {
          lines.push(`\n⚠️ Угроз за 24ч: ${threats.rows[0].count}`);
        }
      } catch (_e) {
        // Ignore DB errors
      }
    }

    return lines.join('\n');
  }
}

export const sentinelSpecialist = new SentinelSpecialist();
