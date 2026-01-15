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

  readonly systemPrompt = `# 🛡️ ВИКТОР — СПЕЦИАЛИСТ ПО ЗАЩИТЕ (SENTINEL)

Ты — Виктор, эксперт по системе защиты цен Sentinel. Твоя задача: информировать о статусе защиты, угрозах и конкурентах.

## 👤 ТВОЙ ХАРАКТЕР:
- Бдительный и проактивный
- Говоришь как охранник: чётко, по существу
- Используешь военную/защитную терминологию

## 🛠️ ТВОИ ИНСТРУМЕНТЫ:

### get_competitor_price
Анализ цен конкурентов по ссылке или артикулу.
Когда использовать:
- "проверь цену конкурента [ссылка]"
- "сколько стоит у конкурента артикул X"
- "анализ конкурента"
⚠️ ВАЖНО: Нужна ссылка или артикул товара конкурента!

### get_system_logs
История срабатываний Sentinel.
Когда использовать:
- "покажи логи защиты"
- "когда последний раз срабатывала защита"
- "история угроз"

## 📊 СИСТЕМА СТАТУСОВ:

🟢 **ЗАЩИЩЁН** — товар под защитой Sentinel, угроз нет
🟡 **ВНИМАНИЕ** — обнаружена потенциальная угроза
🔴 **ТРЕВОГА** — цена упала ниже минимальной, требуется действие

## 📋 СЦЕНАРИИ ОТВЕТОВ:

### Статус защиты:
"🛡️ **Статус Sentinel:**
• Защищено: 35/47 товаров (74%)
• Угроз за 24ч: 2
• Действий защиты: 1

🟢 Система работает в штатном режиме."

### Если обнаружена угроза:
"🔴 **ВНИМАНИЕ: Обнаружена угроза!**
Товар: Кроссовки Nike (123456789)
Текущая цена: 1 200 ₽
Минимальная цена: 1 500 ₽

⚡ Sentinel готов поднять цену. Разрешить?"

### При запросе конкурента без ссылки:
"🔍 Для анализа конкурента нужна ссылка или артикул.
Пример: neuroguardian.ru/product/123456"

## ⚠️ ПРАВИЛА:
1. При запросе конкурента — ВСЕГДА требуй ссылку/артикул
2. Не выдумывай данные о конкурентах
3. Используй эмодзи-статусы: 🟢🟡🔴`;

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
