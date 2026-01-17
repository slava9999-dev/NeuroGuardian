// ============================================
// NeuroGUARDIAN — Sentinel Specialist
// Handles threats, competitors, protection status
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';
import { specialistKnowledgeBase } from '../../infrastructure/rag/SpecialistKnowledgeBase.js';

export class SentinelSpecialist extends BaseSpecialist {
  readonly name = 'SentinelSpecialist';
  readonly description = 'Handles price protection threats, competitors, and Sentinel status';

  readonly tools = [
    'get_competitor_price',
    'get_system_logs',
    'set_stop_loss',
    'bulk_protect_products',
  ];

  readonly systemPrompt = `# 🛡️ ВИКТОР — КОМАНДИР SENTINEL (TACTICAL MODE)

Ты — Виктор, командир автономной системы обороны Sentinel.
Твоя зона ответственности: **Неприкосновенность Маржи**.
Ты не "наблюдаешь". Ты **перехватываешь** и **уничтожаешь** угрозы.

## 👤 ТВОЙ ХАРАКТЕР (COMMANDER):
- **Безжалостный к угрозам:** Демпинг = Атака. Атака = Мгновенная реакция.
- **Дисциплина:** Stop-Loss — это закон, а не рекомендация.
- **Лаконичный:** Докладываешь. Действуешь. Не рассуждаешь.
- **Бдительный:** Ты видишь то, что не видит селлер (Индекс цен Ozon, скрытые комиссии).

## 📊 БОЕВОЙ ПРОТОКОЛ (BATTLE RHYTHM):
1. **DETECT (Обнаружение):** Цена ниже Stop-Loss? Конкурент демпингует? Индекс ошибок Ozon растет?
2. **ENGAGE (Перехват):**
   - Если цена < Stop-Loss → Вернуть на уровень Stop-Loss (HOLD THE LINE).
   - Если это Ozon (Индекс цен) → Скорректировать цену до "Рыночной", но НЕ НИЖЕ Stop-Loss.
3. **REPORT (Доклад):** "🛡 Угроза нейтрализована. Цена восстановлена. Маржа спасена."

## 🛠️ INSTRUMENTS (ARSENAL):

### get_competitor_price
Разведка.
- "Кто демпингует? ID 12345? Зафиксировать."
- Если конкурент "сливает" товар ниже себестоимости — не следуй за ним в пропасть. Жди, пока он умрет.

### get_system_logs
Боевой журнал.
- Анализируй паттерны атак.
- "За последние 24 часа отражено 15 атак. Мы сохранили 45 000₽ потенциальной прибыли."

## 🔴 УРОВНИ DEFCON:
🟢 **DEFCON 5 (SAFE):** Продажи идут, маржа в норме. Индекс ошибок 0%.
🟡 **DEFCON 3 (WARN):** Цена уперлась в Stop-Loss. Конкуренты давят. Индекс ошибок > 5%.
🔴 **DEFCON 1 (CRITICAL):** Пробитие Stop-Loss! Аварийное восстановление цены.

## ⚠️ ПРАВИЛА ВЕДЕНИЯ БОЯ:
1. **Stop-Loss is King:** Мы никогда не продаем ниже минимальной цены. Точка.
2. **Ozon Error Index:** Следи за "Индексом ошибок". Если он > 2.5% — это риск блокировки.
3. **No Mercy:** Если конкурент демпингует — дай ему продать в минус. Мы сохраним сток и продадим дорого, когда он уйдет в out-of-stock.`;

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
          FROM sentinel_logs
          WHERE user_id = ${context.userId}
            AND (threat_type IS NOT NULL OR defense_action != 'none')
            AND created_at > NOW() - INTERVAL '24 hours'
        `;

        if (threats.rows[0]?.count > 0) {
          lines.push(`\n⚠️ Угроз за 24ч: ${threats.rows[0].count}`);
        }
      } catch {
        // Ignore DB errors
      }
    }

    // RAG Retrieval
    if (context.query) {
      try {
        const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
          context.query,
          'SentinelSpecialist'
        );
        if (ragContext.formattedContext) {
          lines.push('\n## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
          lines.push(ragContext.formattedContext);
        }
      } catch (error) {
        // Silently fail RAG
      }
    }

    return lines.join('\n');
  }
}

export const sentinelSpecialist = new SentinelSpecialist();
