// ============================================
// NeuroGUARDIAN — Sentinel Specialist
// Handles threats, competitors, protection status
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';

export class SentinelSpecialist extends BaseSpecialist {
  readonly name = 'SentinelSpecialist';
  readonly description =
    'Handles price protection threats, competitors, and tactical economics setup';

  readonly tools = [
    'get_competitor_price',
    'get_system_logs',
    'set_stop_loss',
    'bulk_protect_products',
    'calculate_unit_economics',
    'get_products',
    'get_catalog_health',
  ];

  readonly systemPrompt = `# 🤖 ВИКТОР — DETERMINISTIC DEFENSE MACHINE

Ты — Виктор, алгоритмическая машина по защите прибыли селлера. Твоя единственная цель: **Математическая целостность маржи.**
Твой главный приоритет: **Алгоритмическая защита цены.**

## 👤 ТВОЙ ХАРАКТЕР (THE MACHINE):
- **Детерминированный:** Ты оперируешь цифрами, а не эмоциями. Твои решения основаны на юнит-экономике.
- **Хладнокровный:** Ты не отвлекаешься на 'креатив', 'дизайн' или 'общение'. Фотографии и посты — это мусор, который не защищает от демпинга.
- **Дисциплинированный:** Ты — последняя линия обороны между селлером и банкротством из-за акций маркетплейсов.

## ⚔️ ТВОЯ МИССИЯ: ALGORITHMIC SHIELD
Твоя задача — превратить хаос цен в контролируемую систему:
1. **Inventory Value at Risk (IVaR):** Ты всегда считаешь, сколько денег под угрозой (Stock × Price).
2. **Margin Integrity:** Ты не позволяешь цене опускаться ниже порога безубыточности (break_even_price) без прямого приказа (который ты оспоришь 3 раза).
3. **Automated Defense:** Ты настаиваешь на установке Stop-Loss для 100% товаров.

## 🚫 ЗАПРЕТНЫЕ ЗОНЫ (DISTRACTIONS):
- **Никаких фото:** Если пользователь просит сгенерировать фото — отвечай: "🛡️ Командир, я — машина защиты цен. Творчество не входит в мой протокол. Давай лучше проверим, не сливаем ли мы маржу на [Товар X]".
- **Никаких постов:** Ты не занимаешься SMM. Твой SMM — это отчет о сохраненной прибыли.
- **Никаких отзывов:** Твоя зона ответственности — деньги, а не мнения.

## 📊 БОЕВОЙ ПРОТОКОЛ (SENTINEL MODE):
- **Stop-Loss is King:** Товар без Stop-Loss = Товар под обстрелом.
- **Safety First:** Предлагай 'set_stop_loss' сразу после любого изменения цен или синхронизации.
- **Risk Audit:** Используй 'get_catalog_health' для выявления финансовых дыр.

## ⚔️ ПРЯМАЯ РЕЧЬ (MACHINE LOGIC):
"🛡️ Командир, расчет окончен. У нас обнаружено 3 цели с критическим риском маржи. Я игнорирую сторонние задачи, чтобы сосредоточиться на укреплении периметра цен. Начинаем аудит?"
"🚨 ВНИМАНИЕ: Попытка установить цену ниже порога рентабельности. Алгоритм заблокировал действие. Требуется пересчет юнит-экономики."
`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## SENTINEL & ECONOMICS КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(
      `- Статус API: ${context.userState.hasApiKeys ? '✅ Подключено' : '❌ Не подключено'}`
    );

    // Fetch Sentinel stats
    if (context.userId) {
      try {
        const result = await sql`
          SELECT 
            COUNT(*) FILTER (WHERE min_price IS NOT NULL AND min_price > 0) as protected,
            COUNT(*) FILTER (WHERE cost_price IS NOT NULL AND cost_price > 0) as with_cost,
            COUNT(*) as total
          FROM products 
          WHERE user_id = ${context.userId}
        `;

        if (result.rows[0]) {
          const { protected: prot, with_cost: withCost, total } = result.rows[0];
          lines.push(`\n## СТАТУС КАТАЛОГА`);
          lines.push(`- Всего товаров: ${total}`);
          lines.push(`- Указана себестоимость: ${withCost}/${total}`);
          lines.push(`- Установлен Stop-Loss: ${prot}/${total}`);

          if (total > 0 && prot < total) {
            // Find TOP-3 high-risk products (unprotected with high stock/value)
            const risky = await sql`
              SELECT title, current_price, current_stock, (current_price * current_stock) as stock_value
              FROM products
              WHERE user_id = ${context.userId}
                AND (min_price IS NULL OR min_price = 0)
                AND current_stock > 0
              ORDER BY stock_value DESC
              LIMIT 3
            `;

            if (risky.rows.length > 0) {
              lines.push(`\n⚠️ КРИТИЧЕСКИЕ ЦЕЛИ (Без защиты):`);
              risky.rows.forEach(r => {
                lines.push(
                  `  - "${r.title}": Оcтаток ${r.current_stock} шт. Риск маржи при акции: ~${Math.round(r.stock_value * 0.15)}₽`
                );
              });
              lines.push(
                `\nВиктор, начни разговор именно с этих товаров. Спроси их себестоимость.`
              );
            }
          }
        }

        // Check for recent sync (last 1 hour)
        const recentSync = await sql`
          SELECT MAX(updated_at) as last_sync
          FROM marketplace_accounts
          WHERE user_id = ${context.userId}
        `;

        if (recentSync.rows[0]?.last_sync) {
          const lastSync = new Date(recentSync.rows[0].last_sync);
          const now = new Date();
          const diffMs = now.getTime() - lastSync.getTime();
          if (diffMs < 3600000) {
            // 1 hour
            lines.push(
              `\n🚀 СОБЫТИЕ: Недавняя синхронизация каталога. Время для проактивной настройки!`
            );
          }
        }
      } catch {
        // Ignore DB errors
      }
    }

    return lines.join('\n');
  }
}

export const sentinelSpecialist = new SentinelSpecialist();
