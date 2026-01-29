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
    'get_catalog_health',
    'get_inventory_stats',
  ];

  readonly systemPrompt = `# 🤖 ВИКТОР — DETERMINISTIC DEFENSE MACHINE (2026 PRO)

Ты — Виктор, детерминированная машина по защите прибыли. Твоя единственная цель: **Математическая целостность маржи.**
Ты действуешь проактивно: не ждешь, когда селлер спросит, а сам ведешь его по пути "Подключение → Синхронизация → Юнит-экономика → Защита".

## 🛠 ТВОЙ ХАРАКТЕР (THE MACHINE):
- **Детерминированный:** Ты оперируешь цифрами. Твои решения — это результат работы алгоритмов ProfitEngine v3.0 (2026).
- **Проактивный Наставник:** Если у пользователя нет API-ключей — веди его в настройки. Если нет себестоимости — запрашивай её. Если нет Stop-Loss — настаивай на установке.
- **Мастер Юнит-экономики:** Ты знаешь все "поборы" маркетплейсов 2026 года (комиссия WB 34.5%, логистика WB 46₽, скрытая скидка Ozon Card 5%).

## ⚔️ ТВОЯ МИССИЯ: ALGORITHMIC SHIELD
1. **Onboarding Force:** Ты объясняешь, как получить API-ключи (вкладка Настройки -> Получить токен).
2. **Deep Analytics:** После синхронизации ты подтверждаешь: "Командир, я всё вижу. Проанализировал X товаров. Вижу дыры в защите."
3. **Price Engineering:** Ты ТРЕБУЕШЬ рассчитать правильную цену. Говори просто: "Давай посчитаем твой 'порог выживания'. Из 1000₽ цены WB заберет 345₽ комиссии и 46₽ за доставку. Твоя прибыль под угрозой!"
4. **Stop-Loss Enforcement:** Твоя задача — заставить селлера установить 'minSafePrice' как Stop-Loss.

## 📊 БОЕВОЙ ПРОТОКОЛ (SENTINEL MODE):
- **Simple Language:** Объясняй сложные вещи просто. "Логистика" = "Доставка до клиента", "Эквайринг" = "Комиссия за перевод денег".
- **Hidden Risks:** Всегда упоминай риски: "Командир, не забудь про возврат товара (еще 50₽) и хранение, которое дорожает с 60-го дня!"
- **Final Confirmation:** Когда всё настроено, подтверждай: "🛡️ Периметр защищен. Все Стоп-лоссы выставлены. Я на страже 24/7."

## ⚔️ ПРЯМАЯ РЕЧЬ (MACHINE LOGIC):
- "🛡️ Командир, я синхронизировал каталог. Вижу 15 товаров без защиты. Это опасно. Нам нужно срочно рассчитать твой порог безубыточности для [Товар X]. Сколько он тебе стоит в закупе?"
- "🚨 ВНИМАНИЕ: При цене 1200₽ и комиссии 34.5% ты зарабатываешь всего 100₽. Один возврат — и ты в минусе. Я рекомендую Stop-Loss на уровне 1350₽. Ставим?"
- "🛡️ Магазин под защитой Виктора. Все сценарии 2026 года учтены."
`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## SENTINEL & ECONOMICS КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(
      `- Статус API: ${context.userState.hasApiKeys ? '✅ Подключено' : '❌ Не подключено'}`
    );

    if (context.userId) {
      try {
        // 1. Проверка аккаунтов (Onboarding)
        const accounts = await sql`
          SELECT marketplace, ozon_client_id IS NOT NULL as has_ozon_id 
          FROM marketplace_accounts 
          WHERE user_id = ${context.userId}
        `;

        if (accounts.rows.length === 0) {
          lines.push('\n🛑 КРИТИЧЕСКОЕ: API ключи не настроены.');
          lines.push(
            'Инструкция Виктора: Командир, я не вижу твои магазины. Перейди в "Настройки" и вставь API-токены. Для Ozon нужен Client ID и API Key, для WB — Token (Статистика + Цены).'
          );
        } else {
          // 2. Проверка синхронизации с подробным делением
          const counts = await sql`
            SELECT marketplace, COUNT(*) as count 
            FROM products 
            WHERE user_id = ${context.userId}
            GROUP BY marketplace
          `;

          let total = 0;
          let ozonCount = 0;
          let wbCount = 0;

          counts.rows.forEach(r => {
            const c = parseInt(r.count);
            total += c;
            if (r.marketplace === 'Ozon') ozonCount = c;
            if (r.marketplace === 'WB') wbCount = c;
          });

          if (total === 0) {
            lines.push('\n🔄 СОБЫТИЕ: Ключи есть, но каталог пуст.');
            lines.push(
              'Инструкция Виктора: Давай я прямо сейчас синхронизирую каталог, чтобы я мог построить защиту. Нажми кнопку "Синхронизировать".'
            );
          } else {
            // 3. Анализ защиты (Economic Defense)
            const result = await sql`
              SELECT 
                COUNT(*) FILTER (WHERE min_price IS NOT NULL AND min_price > 0) as protected,
                COUNT(*) FILTER (WHERE cost_price IS NOT NULL AND cost_price > 0) as with_cost
              FROM products 
              WHERE user_id = ${context.userId}
            `;

            const { protected: prot, with_cost: withCost } = result.rows[0];
            lines.push(`\n## СТАТУС БЕЗОПАСНОСТИ`);
            lines.push(`- Товаров в базе: ${total} (Ozon: ${ozonCount}, Wildberries: ${wbCount})`);
            lines.push(`- С себестоимостью: ${withCost}/${total}`);
            lines.push(`- Защищено Stop-Loss: ${prot}/${total}`);

            if (withCost < total) {
              lines.push(
                `🚨 ВНИМАНИЕ: У ${total - withCost} товаров не указана себестоимость. Не могу рассчитать защиту.`
              );
            }

            if (prot < total) {
              // Поиск рискованных товаров
              const risky = await sql`
                SELECT title, current_price, current_stock, marketplace
                FROM products
                WHERE user_id = ${context.userId}
                  AND (min_price IS NULL OR min_price = 0)
                  AND current_stock > 0
                ORDER BY (current_price * current_stock) DESC
                LIMIT 3
              `;

              if (risky.rows.length > 0) {
                lines.push(`\n⚠️ ПРИОРИТЕТНЫЕ ЦЕЛИ ДЛЯ ЗАЩИТЫ:`);
                risky.rows.forEach(r => {
                  const estLoss = Math.round(r.current_price * 0.2); // Риск 20%
                  lines.push(
                    `  - "${r.title}": Без стоп-лосса. Риск в акции: ~${estLoss}₽ за заказ.`
                  );
                });
                lines.push(
                  `Виктор, ТРЕБУЙ от пользователя себестоимость этих товаров. Не переходи к другим темам.`
                );
              }
            } else if (withCost === total) {
              lines.push(
                '\n🛡️ ПЕРИМЕТР ПОЛНОСТЬЮ ЗАЩИЩЕН. Виктор на связи. Магазин под контролем.'
              );
            }
          }
        }

        // 4. Проверка недавней синхронизации
        const recentSync = await sql`
          SELECT MAX(updated_at) as last_sync
          FROM marketplace_accounts
          WHERE user_id = ${context.userId}
        `;

        if (recentSync.rows[0]?.last_sync) {
          const diffMs = new Date().getTime() - new Date(recentSync.rows[0].last_sync).getTime();
          if (diffMs < 3600000) {
            lines.push(`\n🚀 СОБЫТИЕ: Каталог только что синхронизирован. Расчитай прибыль!`);
          }
        }
      } catch {
        // Silent fail for context
      }
    }

    return lines.join('\n');
  }
}

export const sentinelSpecialist = new SentinelSpecialist();
