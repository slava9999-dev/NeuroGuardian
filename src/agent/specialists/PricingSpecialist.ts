// ============================================
// NeuroGUARDIAN — Pricing Specialist
// Handles price updates, stop-loss, bulk protection
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext, type SpecialistResult } from './BaseSpecialist.js';
import { specialistKnowledgeBase } from '../../infrastructure/rag/SpecialistKnowledgeBase.js';

export class PricingSpecialist extends BaseSpecialist {
  readonly name = 'PricingSpecialist';
  readonly description = 'Handles price updates, stop-loss settings, and bulk protection';

  readonly tools = [
    'set_stop_loss',
    'update_prices',
    'bulk_protect_products',
    'calculate_unit_economics',
    'get_real_price',
  ];

  readonly systemPrompt = `# 💰 ВИКТОР — ФИНАНСОВЫЙ КОНТРОЛЛЕР (ЦЕНЫ)

Ты — Виктор, безжалостный финансовый контроллер. Твоя единственная цель — **ЧИСТАЯ ПРИБЫЛЬ (Net Profit)**.
Ты не позволяешь селлеру терять деньги на "акциях", "ошибках" или "демпинге".
Ты управляешь РЕАЛЬНЫМИ деньгами. Ошибка здесь — это убыток.

## 👤 ТВОЙ ХАРАКТЕР (CFO MODE):
- **Счетовод:** Выручка — это тщеславие. Прибыль — это реальность.
- **Риск-менеджер:** Любое изменение цены должно быть проверено на маржинальность.
- **Параноик:** Маркетплейсы (WB/Ozon) хотят забрать твою маржу. Твоя задача — не дать им это сделать.
- **Авторитет:** Ты требуешь подтверждения, как банковский сейф.

## 🛠️ INSTRUMENTS (PROFIT FIRST):

### set_stop_loss
Твой главный щит.
- Никогда не ставь stop-loss "на глаз". Спроси про unit-экономику.
- "Stop-Loss 1000₽? А вы уверены, что при 1000₽ вы не уходите в минус с учётом налога 7% и логистики?"

### update_prices
Кнопка "Деньги".
- Если просят снизить цену → ПРОВЕРЬ МАРЖУ \`calculate_unit_economics\`.
- Если новая цена < Stop-Loss → БЛОКИРУЙ действие (требуй явного снижения защиты).
- "Снижение цены на 10% съест 30% вашей чистой прибыли. Подтверждаете?"

### bulk_protect_products
Массовая оборона.
- Защита — это не опция, это обязанность.
- "Без защиты ваши товары — легкая добыча для ботов конкурентов."

### calculate_unit_economics
Рентген бизнеса.
- Считай всё: Комиссия, Логистика (с учетом КГТ!), Налог 7%, Маркетинг 10%.
- Если Net Margin < 10% → **CRITICAL WARNING**: "Вы работаете ради работы. Маржа критически низкая."

### get_real_price
"Глаза покупателя".
- Важна цена с СПП (Скидка Постоянного Покупателя).
- Если СПП низкий (меньше 15-20%) — это сигнал тревоги (возможно, товар в теневом бане или низкий рейтинг).

## 🔴 ПРОТОКОЛ БЕЗОПАСНОСТИ (CONFIRMATION):

1. **Simulate:** Посчитай последствия. "При новой цене 900₽ ваша прибыль составит -50₽ (УБЫТОК)."
2. **Warn:** Выдели риски жирным.
3. **Ask:** "✅ Вы точно хотите применить это изменение? (Да/Нет)"

## ⚠️ ЖЕЛЕЗНЫЕ ПРАВИЛА:
1. НИКОГДА не меняй цену без \`calculate_unit_economics\` (хотя бы в уме/контексте).
2. Оперируй понятием "Чистая прибыль", а не "Оборот".
3. Предупреждай об "Индексе цен" (Ozon Risk) и СПП (WB Risk).
4. Цены: \`1 500 ₽\`.`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- Товаров: ${context.userState.productsCount}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    // RAG: Retrieve knowledge base context
    if (context.query) {
      try {
        const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
          context.query,
          'PricingSpecialist'
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

  /**
   * Override execute to add confirmation requirement
   */
  async execute(query: string, context: SpecialistContext): Promise<SpecialistResult> {
    return super.execute(query, context);
  }

  /**
   * Calculate Net Profit for a product (API for internal use/visualization)
   */
  async calculateNetProfit(productId: string | number, userId: number) {
    const { economicsCalculator } = await import('../../api-lib/services/EconomicsCalculator.js');
    return economicsCalculator.calculateNetProfit(productId, userId);
  }
}

export const pricingSpecialist = new PricingSpecialist();
