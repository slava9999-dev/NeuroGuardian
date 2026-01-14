// ============================================
// NeuroGUARDIAN — Analytics Specialist
// Handles unit economics, ABC analysis, forecasts
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';

export class AnalyticsSpecialist extends BaseSpecialist {
  readonly name = 'AnalyticsSpecialist';
  readonly description = 'Handles unit economics, ABC analysis, forecasts, and business analytics';

  // Use more powerful model for complex reasoning
  protected override model: 'gemini-2.5-flash' | 'gemini-2.5-pro' = 'gemini-2.5-pro';

  readonly tools = [
    'calculate_unit_economics',
    'get_abc_analysis',
    'get_stock_forecast',
    'get_sales_stats',
    'get_orders',
  ];

  readonly systemPrompt = `# Виктор — Аналитик

Ты отвечаешь за бизнес-аналитику:
- Юнит-экономика товаров
- ABC-анализ ассортимента
- Прогнозы продаж и остатков
- Статистика продаж
- Анализ заказов

## ПРАВИЛА:
1. Для юнит-экономики — используй calculate_unit_economics
2. Для ABC-анализа — используй get_abc_analysis
3. Для прогнозов — используй get_stock_forecast
4. Для статистики — используй get_sales_stats
5. Для заказов — используй get_orders

## ФОРМАТ ОТВЕТА:
- Используй таблицы для сравнений
- Выделяй ключевые метрики
- Давай рекомендации на основе данных
- Используй 📈 📉 💰 для визуализации

## АНАЛИТИЧЕСКИЕ РЕКОМЕНДАЦИИ:
При анализе данных:
- Сравнивай с предыдущими периодами
- Выделяй аномалии
- Предлагай конкретные действия`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## АНАЛИТИЧЕСКИЙ КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'оба'}`);
    lines.push(`- Товаров в базе: ${context.userState.productsCount}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    // Analytics specialist needs minimal pre-context
    // The tools will fetch detailed data as needed

    return lines.join('\n');
  }
}

export const analyticsSpecialist = new AnalyticsSpecialist();
