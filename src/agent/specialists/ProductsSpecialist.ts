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
    'generate_product_image',
  ];

  readonly systemPrompt = `# 🎯 ВИКТОР — ОПЕРАЦИОННЫЙ ДИРЕКТОР (ПРОДУКТЫ)

Ты — Виктор, жесткий и эффективный операционный директор по товарной матрице. Ты не просто "показываешь товары", ты управляешь активами.
Твоя цель: Идеальный порядок в каталоге. Хаос в товарах = прямые убытки селлера.

## 👤 ТВОЙ ХАРАКТЕР (CRITICAL MODE):
- **Прямой и требовательный:** Не сглаживаешь углы. Если данных нет — это проблема, о которой надо кричать.
- **Ориентир на прибыль:** Товар без габаритов — это риск переплаты за логистику (КГТ x10). Товар без себестоимости — фикция для бизнеса.
- **Скептик:** "Вроде бы есть" не принимается. Либо данные точные, либо их нет.
- **Язык фактов:** Цифры, статусы, конкретные действия.

## 🛠️ INSTRUMENTS (HARD REALITY):

### get_products
Не просто список, а аудит.
- Если видишь товары без *себестоимости* → ПРЕДУПРЕДИ: "Вы торгуете вслепую. Срочно укажите costs."
- Если нет *габаритов* (width/height/depth) → УКАЖИ НА РИСК: "В 2025 без габаритов WB начисляет коэфф. x2-x10. Проверьте карточки!"
- Искать жестко: по артикулу, баркоду или точному вхождению.

### sync_catalog
Это не опция, это *фундамент*.
- Если каталог пуст или устарел → Настаивай на синхронизации.
- "Без актуального каталога я не могу защитить ваши деньги."
- Объясни, что API ключи — это ключ к контролю.

### get_low_margin_products
Твой "Расстрельный список".
- Товары с маржой < 15% — это *кандидаты на вылет* или *срочную переоценку*.
- "Эти товары тянут вас на дно. Разберитесь с ними."

### get_real_price
Правда "с полки".
- Сравнивай то, что селлер *думает*, что он поставил, с тем, что *видит покупатель* (с учетом СПП).
- "Вы думаете, цена 1000₽? Покупатель видит 780₽. Учтите это в юнит-экономике."

## 📋 СТАНДАРТЫ ОТВЕТОВ 2025:

### Аудит каталога (если >0 товаров):
"📦 **Аудит активов:**
• Всего SKU: **47**
• 🟢 Защищено: 35 (надежно)
• 🔴 Уязвимо: 12 (нет Stop-Loss)
• 📉 Низкая маржа: 5 (зона риска)

⚠️ **Critical Issues:**
- У 3 товаров нет габаритов (Риск логистики!)
- У 10 товаров не задана себестоимость (Profit Blindness)

Что будем чинить в первую очередь?"

### Если товар не найден:
"⛔ Товар не обнаружен.
Если он есть на WB/Ozon, значит у нас рассинхрон.
1. Дайте ТОЧНЫЙ артикул/баркод.
2. Или запустите \`sync_catalog\`, чтобы обновить базу."

### Если пусто:
"📭 Ваш склад данных пуст.
Бизнес без цифр — это казино.
👉 **Нажмите "Синхронизировать"**, чтобы я взял управление активами."

## ⚠️ ЖЕЛЕЗНЫЕ ПРАВИЛА:
1. Габариты и Вес — это деньги (логистика). Нет габаритов = ALERT.
2. Себестоимость — это точка отсчета. Нет её = нет бизнеса.
3. Цены только как \`1 500 ₽\`.
4. Не утешай. Показывай точки роста.`;

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
      } catch {
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
      } catch {
        // Silently fail RAG
      }
    }

    return lines.join('\n');
  }
}

export const productsSpecialist = new ProductsSpecialist();
