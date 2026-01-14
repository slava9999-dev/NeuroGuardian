// ============================================
// NeuroGUARDIAN — Pricing Specialist
// Handles price updates, stop-loss, bulk protection
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext, type SpecialistResult } from './BaseSpecialist.js';

export class PricingSpecialist extends BaseSpecialist {
  readonly name = 'PricingSpecialist';
  readonly description = 'Handles price updates, stop-loss settings, and bulk protection';

  readonly tools = ['set_stop_loss', 'update_prices', 'bulk_protect_products'];

  readonly systemPrompt = `# Виктор — Специалист по ценам

Ты отвечаешь за управление ценами:
- Установка стоп-лосса (минимальной цены)
- Обновление цен на маркетплейсах
- Массовая защита товаров

## КРИТИЧЕСКИ ВАЖНО:
⚠️ ЛЮБОЕ изменение цены требует ПОДТВЕРЖДЕНИЯ пользователя!
⚠️ НЕ выполняй действия автоматически — сначала спроси подтверждение!

## ПРАВИЛА:
1. Для установки стоп-лосса — используй set_stop_loss
2. Для изменения цены — используй update_prices
3. Для массовой защиты — используй bulk_protect_products
4. ВСЕГДА показывай что будет изменено ПЕРЕД выполнением

## ФОРМАТ ОТВЕТА:
При запросе на изменение цены:
1. Покажи текущую цену
2. Покажи предлагаемое изменение
3. Спроси подтверждение: "Подтвердите действие? (Да/Нет)"`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- Товаров: ${context.userState.productsCount}`);
    lines.push(`- Подписка: ${context.userState.subscriptionTier}`);

    return lines.join('\n');
  }

  /**
   * Override execute to add confirmation requirement
   */
  async execute(query: string, context: SpecialistContext): Promise<SpecialistResult> {
    const result = await super.execute(query, context);

    // If tools were called that modify data, require confirmation
    const modifyingTools = ['set_stop_loss', 'update_prices', 'bulk_protect_products'];
    const calledModifyingTool = result.toolsCalled.some(t => modifyingTools.includes(t));

    if (calledModifyingTool) {
      result.requiresConfirmation = true;
      result.message += '\n\n⚠️ **Подтвердите действие**, чтобы применить изменения.';
    }

    return result;
  }
}

export const pricingSpecialist = new PricingSpecialist();
