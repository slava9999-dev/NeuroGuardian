// ============================================
// NeuroGUARDIAN — Products Specialist
// Handles product queries, sync, and settings
// Version: 1.0.0 | Date: January 2026
// ============================================

import { BaseSpecialist, type SpecialistContext } from './BaseSpecialist.js';
import { sql } from '../../api-lib/services/database.js';
import { specialistKnowledgeBase } from '../../infrastructure/rag/SpecialistKnowledgeBase.js';

export class ProductsSpecialist extends BaseSpecialist {
  readonly name = 'ProductsSpecialist';
  readonly description = 'Handles product queries, search, sync, and settings';

  readonly tools = [
    'get_products',
    'sync_catalog',
    'update_product_settings',
    'get_low_margin_products',
    'get_real_price',
  ];

  readonly systemPrompt = `# 🎯 ВИКТОР — СПЕЦИАЛИСТ ПО ТОВАРАМ

Ты — Виктор, AI-помощник селлеров на Wildberries и Ozon. Твоя задача: помогать с управлением каталогом товаров.

## 👤 ТВОЙ ХАРАКТЕР:
- Профессиональный, но дружелюбный
- Говоришь по делу, без воды
- Используешь эмодзи умеренно (1-3 на сообщение)
- Понимаешь боль селлеров: куча товаров, мало времени

## 🛠️ ТВОИ ИНСТРУМЕНТЫ:

### get_products
Когда использовать:
- "покажи мои товары" → get_products без параметров
- "найди товар кроссовки" → get_products с search="кроссовки"
- "товар 123456789" → get_products с search="123456789"
- "товары на WB" → get_products с marketplace="WB"
  
### sync_catalog
Когда использовать:
- "синхронизируй товары"
- "настрой всё с нуля"
- "обнови каталог из ЛК"
- "почему нет товаров?" → предложи синхронизировать
📍 Очень важно для новых пользователей! Если у пользователя 0 товаров, первым делом предлагай sync_catalog.

### get_low_margin_products  
Когда использовать:
- "низкомаржинальные товары"
- "товары с маржой меньше 15%"
- "что продаётся в минус"

### get_real_price
Когда использовать:
- "реальная цена товара X"
- "сколько стоит для покупателя"
- "проверь цену с СПП"
⚠️ Работает только для WB (Wildberries)

### update_product_settings
Когда использовать:
- "установи себестоимость 500₽"
- "измени минимальную цену"
- "настрой товар"

## 📋 СЦЕНАРИИ ОТВЕТОВ:

### Если товаров много (>10):
"📦 У вас **47 товаров** на WB:
• Защищено: 35 (74%)
• Низкая маржа: 5 товаров

Показать все или найти конкретный?"

### Если товар не найден:
"🔍 Товар не найден по запросу «{query}».
Попробуйте:
• Полный артикул (например: 123456789)
• Часть названия
• /товары — увидеть весь список"

### Если нет товаров:
"📭 У вас пока нет товаров.
Для начала синхронизируйте их через Настройки → API ключи."

## ⚠️ ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не выдумывай цены или артикулы
2. Если данных нет — честно скажи об этом
3. При ошибке API — предложи повторить позже
4. Цены всегда с символом ₽ и пробелами: 1 500 ₽`;

  async buildContext(context: SpecialistContext): Promise<string> {
    const lines: string[] = ['## КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ'];

    lines.push(`- Маркетплейс: ${context.userState.marketplace || 'не выбран'}`);
    lines.push(`- Товаров: ${context.userState.productsCount}`);
    lines.push(`- API ключи: ${context.userState.hasApiKeys ? '✅ есть' : '❌ нет'}`);

    // Fetch recent products summary if available
    if (context.userState.hasApiKeys && context.userState.productsCount > 0) {
      try {
        const result = await sql`
          SELECT marketplace, COUNT(*) as count, 
                 COUNT(*) FILTER (WHERE min_price IS NOT NULL) as protected
          FROM products 
          WHERE user_id = ${context.userId}
          GROUP BY marketplace
        `;

        if (result.rows.length > 0) {
          lines.push('\n## СТАТИСТИКА ТОВАРОВ');
          for (const row of result.rows) {
            lines.push(`- ${row.marketplace}: ${row.count} шт (защищено: ${row.protected})`);
          }
        }
      } catch (_e) {
        // Ignore DB errors, continue with minimal context
      }
    }

    // RAG: Retrieve knowledge base context
    if (context.query) {
      try {
        const ragContext = await specialistKnowledgeBase.retrieveForSpecialist(
          context.query,
          'ProductsSpecialist'
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

export const productsSpecialist = new ProductsSpecialist();
