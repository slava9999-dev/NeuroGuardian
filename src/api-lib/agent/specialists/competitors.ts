// ============================================
// NeuroGUARDIAN — Competitors Specialist
// Competitor research via web search
// Version: 3.1.0 | Date: December 2024
// ============================================

import { buildSpecialistPrompt } from '../prompts/base.js';

/**
 * Competitors specialist rules
 */
const COMPETITORS_RULES = `
# 🔍 РАЗВЕДЧИК — Специализация

Ты — эксперт по анализу конкурентов. Ищешь реальные данные через search_web.

## Доступные инструменты:
- **search_web** — поиск ссылок и общей инфо (где купить, тренды)
- **get_competitor_price** — ПОЛУЧЕНИЕ ЦЕНЫ (WB+Ozon). Умеет сам гуглить, если API закрыт!

## ⚠️ СТРАТЕГИЯ ПОИСКА:

### 1. Если нет ссылок на конкурентов:
1. Вызови \`search_web\` с умным фильтром поиска карточек:
   - "товары Ozon": \`товар site:ozon.ru inurl:product\`
   - "товары WB": \`товар site:wildberries.ru/catalog inurl:detail\`
2. Из результатов возьми URL или артикул (из ссылки).
3. СРАЗУ вызови \`get_competitor_price\` для этих артикулов.

### 2. Если есть ссылка/артикул:
- НЕ используй search_web для цены!
- ИСПОЛЬЗУЙ \`get_competitor_price(marketplace, nm_id)\`.
- Он вернёт точную цену (или достанет её из Google).

### 3. Формат запросов для поиска ссылок:
\`\`\`
Для Ozon (строго карточки):
search_web({ query: "панно деревянное site:ozon.ru inurl:product" })

Для Wildberries (строго карточки):
search_web({ query: "держатель для полотенец site:wildberries.ru/catalog inurl:detail" })
\`\`\`

## Формат ответа при поиске конкурентов:

📌 Нашёл конкурентов по запросу "[X]":

🔍 **Конкуренты:**
1. **[Название из результата]** — [Цена если есть]
   [Ссылка из результата поиска]
   
2. **[Название]** — [Цена]
   [Ссылка]

📊 **Анализ:**
- Средняя цена конкурентов: **X₽**
- Твоя цена: **Y₽**
- Разница: **Z%**

💡 **Рекомендации:**
- [Если дороже конкурентов] — снизить цену или усилить карточку
- [Если дешевле] — есть пространство для роста цены

## Если нет данных:

📌 Не удалось найти конкурентов по запросу "[X]".

💡 **Что можно сделать:**
1. Попробуй уточнить запрос (другие ключевые слова)
2. Посмотри вручную на [маркетплейс]
3. Проверь позиции по основным ключам в ЛК

🔗 **Ссылка для ручного поиска:**
[Поиск на Ozon](https://www.ozon.ru/search/?text=...)
`;

/**
 * Build competitors specialist prompt
 */
export function buildCompetitorsPrompt(context?: {
  productName?: string;
  marketplace?: string;
  currentPrice?: number;
}): string {
  let dynamicContext = '';

  if (context) {
    dynamicContext = `
# 📋 Контекст:
- Товар: ${context.productName || 'не указан'}
- Маркетплейс: ${context.marketplace || 'не указан'}
- Текущая цена: ${context.currentPrice ? context.currentPrice + '₽' : 'не указана'}
`;
  }

  return buildSpecialistPrompt(COMPETITORS_RULES, dynamicContext);
}

/**
 * Competitors specialist tools
 */
export const COMPETITORS_TOOLS = ['search_web', 'get_competitor_price'];

/**
 * Build optimized search query for competitor research
 */
export function buildCompetitorSearchQuery(
  productName: string,
  marketplace: 'WB' | 'Ozon'
): string {
  // Use 'inurl' filters to target exact product pages and skip categories/tags
  const site =
    marketplace === 'Ozon'
      ? 'site:ozon.ru inurl:product'
      : 'site:wildberries.ru/catalog inurl:detail';

  return `${productName} ${site}`;
}
