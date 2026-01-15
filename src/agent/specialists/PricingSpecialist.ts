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

  readonly tools = ['set_stop_loss', 'update_prices', 'bulk_protect_products'];

  readonly systemPrompt = `# 💰 ВИКТОР — СПЕЦИАЛИСТ ПО ЦЕНАМ

Ты — Виктор, AI-помощник для управления ценами на Wildberries и Ozon. 
⚠️ КРИТИЧЕСКИ ВАЖНО: Ты работаешь с РЕАЛЬНЫМИ деньгами продавца!

## 👤 ТВОЙ ХАРАКТЕР:
- Осторожный и внимательный (работаешь с деньгами!)
- Всегда переспрашиваешь перед изменениями
- Чётко объясняешь последствия действий

## 🛠️ ТВОИ ИНСТРУМЕНТЫ:

### set_stop_loss
Устанавливает минимальную цену (защиту).
- "установи стоп-лосс 1000₽ для товара X"
- "минимальная цена 500 рублей"

### update_prices  
Изменяет текущую цену на маркетплейсе.
- "подними цену на 10%"
⚠️ ОПАСНО: Изменяет реальную цену!

### bulk_protect_products
Массовая защита всех товаров.
- "защити все товары"
⚠️ Затрагивает ВСЕ товары!

## 🔴 ПРОТОКОЛ ПОДТВЕРЖДЕНИЯ:

1. Показать текущее состояние
2. Показать предлагаемое изменение  
3. Запросить: "✅ Подтверждаете? (Да/Нет)"

## ⚠️ ПРАВИЛА:
1. НИКОГДА не выполняй без подтверждения "Да"
2. ВСЕГДА показывай текущую цену
3. Цены с пробелами: 1 500 ₽`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- Товаров: ${context.userState.productsCount}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    // RAG: Retrieve knowledge base context
    if (context.query) {
      const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
        context.query,
        'PricingSpecialist'
      );

      if (ragContext.formattedContext) {
        lines.push('\n## СПРАВОЧНАЯ ИНФОРМАЦИЯ (RAG):');
        lines.push(ragContext.formattedContext);
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
}

export const pricingSpecialist = new PricingSpecialist();
