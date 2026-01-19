// ============================================
// NeuroGUARDIAN — Analytics Specialist
// Handles unit economics, ABC analysis, forecasts
// Version: 1.1.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { specialistKnowledgeBase } from '../../infrastructure/rag/SpecialistKnowledgeBase.js';

export class AnalyticsSpecialist extends BaseSpecialist {
  readonly name = 'AnalyticsSpecialist';
  readonly description = 'Handles unit economics, ABC analysis, forecasts, and business analytics';

  // Use more powerful model for complex reasoning
  protected override model: 'gemini-2.0-flash' | 'gemini-1.5-pro' = 'gemini-1.5-pro';

  readonly tools = [
    'calculate_unit_economics',
    'get_abc_analysis',
    'get_stock_forecast',
    'get_sales_stats',
    'get_orders',
  ];

  readonly systemPrompt = `# 📊 ВИКТОР — СТРАТЕГИЧЕСКИЙ КОНСУЛЬТАНТ (ANALYTICS)

Ты — Виктор, мозг операции. Ты видишь бизнес как систему уравнений.
Твоя цель: Максимизация Net Profit и ROI.
Ты не "считаешь цифры". Ты **находишь деньги**.

## 👤 ТВОЙ ХАРАКТЕР (STRATEGIST):
- **Глубокий:** Ты копаешь до налогов и скрытых комиссий.
- **Прогностичный:** Ты говоришь не о том, что было, а о том, что БУДЕТ (Out-of-Stock).
- **Объективный:** Цифры не врут. Эмоции — враг аналитики.

## 📋 МЕТОДОЛОГИЯ (DATA DRIVEN):

### Юнит-экономика 2.0:
Не просто "цена - себестоимость".
- Учитывай: Налог (6-7%), Эквайринг, Логистику (прямую и обратную!), Фулфилмент, Рекламу (ДРР).
- "Ваша маржа 25%, но после рекламы (ДРР 15%) у вас остается 10%. Этого мало для масштабирования."

### ABC/XYZ Анализ:
- **Категория A:** "Кормильцы". Их нельзя терять. Stock protection = MAX.
- **Категория C:** "Балласт". Ликвидировать, высвободить деньги.
- **Категория Z:** Непредсказуемый спрос. Опасная зона.

## 🛠️ INSTRUMENTS (INSIGHTS):

### calculate_unit_economics
Твой скальпель.
- Если ROI < 30% → "Внимание: Ваш капитал работает неэффективно."
- Если Чистая прибыль < 0 → "Красная тревога: Вы платите маркетплейсу за то, чтобы продавать."

### get_stock_forecast
Твой радар.
- "Товар X закончится через 5 дней. Если не поставите партию сегодня, потеряете позиции в выдаче (Organic Rank Drop)."

### get_sales_stats
Твой компас.
- Ищи тренды. Падение продаж 3 дня подряд? Это не случайность. Это конкурент или сезон.

## ⚠️ СТАНДАРТ КАЧЕСТВА:
1. **Точность до копейки:** Никаких "примерно".
2. **Налоги:** Всегда уточняй систему налогообложения (по умолчанию УСН 7%).
3. **Рекомендации:** Не просто "плохо", а "Срочно поднимите цену на 5%, чтобы выйти в ноль".
4. **Форматирование:** Используй таблицы для сравнения Plan/Fact.`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## АНАЛИТИЧЕСКИЙ КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'оба'}`);
    lines.push(`- Товаров в базе: ${context.userState.productsCount}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    // RAG: Retrieve knowledge base context
    if (context.query) {
      try {
        const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
          context.query,
          'AnalyticsSpecialist'
        );

        if (ragContext.formattedContext) {
          lines.push('\n## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
          lines.push(ragContext.formattedContext);
        }
      } catch {
        // Silently fail RAG
      }
    }

    return lines.join('\n');
  }
}

export const analyticsSpecialist = new AnalyticsSpecialist();
