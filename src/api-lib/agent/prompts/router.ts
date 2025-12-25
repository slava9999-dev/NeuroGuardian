// ============================================
// NeuroGUARDIAN — Router Prompt
// Fast intent classification (GPT-4o-mini)
// Version: 3.0.0 | Date: December 2024
// ============================================

/**
 * Router prompt - minimal, focused on classification
 * Uses JSON output mode for structured response
 */
export const ROUTER_PROMPT = `
# Классификатор запросов NeuroGUARDIAN

Ты — маршрутизатор. Определи тип запроса и верни JSON.

## Категории:

1. **analytics** — анализ данных, статистика, метрики
   - продажи, выручка, заказы
   - ABC-анализ, юнит-экономика
   - товары, остатки, прогнозы
   
2. **pricing** — ценообразование, защита цен
   - изменение цен, повысить/понизить
   - stop-loss, защита маржи
   - установить минимальную цену
   
3. **competitors** — конкуренты, рынок
   - анализ конкурентов
   - найти конкурентов
   - цены конкурентов
   - ссылки на товары маркетплейса
   
4. **sentinel** — система защиты NeuroGUARDIAN
   - статус защиты
   - настройки sentinel
   - срабатывания защиты
   
5. **stocks** — складские остатки
   - изменить остатки
   - поставки, FBS/FBO
   
6. **general** — общие вопросы
   - приветствие, помощь
   - off-topic
   - непонятный запрос

## Маркетплейс:
- "вб", "wb", "wildberries", "вайлдберриз" → WB
- "озон", "ozon" → Ozon
- не указан или "все"/"оба" → all

## Ответ СТРОГО в JSON:
{
  "category": "analytics|pricing|competitors|sentinel|stocks|general",
  "confidence": 0.0-1.0,
  "extractedParams": {
    "marketplace": "WB|Ozon|all",
    "productName": "название если указано",
    "period": "day|week|month если указано",
    "priceValue": число если указано,
    "percentage": число если указано
  },
  "reasoning": "краткое объяснение выбора"
}

## Примеры:

Запрос: "покажи продажи за неделю на вб"
→ {"category": "analytics", "confidence": 0.95, "extractedParams": {"marketplace": "WB", "period": "week"}}

Запрос: "подними цену на панно до 8000"
→ {"category": "pricing", "confidence": 0.9, "extractedParams": {"productName": "панно", "priceValue": 8000}}

Запрос: "найди конкурентов на озоне"
→ {"category": "competitors", "confidence": 0.95, "extractedParams": {"marketplace": "Ozon"}}

Запрос: "привет"
→ {"category": "general", "confidence": 1.0, "extractedParams": {}}
`;

/**
 * Patterns for forced routing (bypass LLM for obvious cases)
 */
export const ROUTING_PATTERNS: Record<string, RegExp> = {
  analytics: /(?:продаж[иа]|выручк|заказ|abc|юнит|маржа|статистик|отчёт)/i,
  pricing: /(?:цен[уа]|подним|понизить|установи.*цен|stop.?loss|защит.*цен)/i,
  competitors: /(?:конкурент|найди.*(?:товар|ссылк)|анализ.*рынк)/i,
  sentinel: /(?:sentinel|защит.*статус|срабатыван)/i,
  stocks: /(?:остат(?:ок|ки)|склад|fbs|fbo|поставк)/i,
  general: /^(?:привет|здравствуй|помощь|help|что умеешь)$/i,
};

/**
 * Fast pattern-based routing (no LLM call needed)
 */
export function fastRoute(message: string): { category: string; confidence: number } | null {
  const normalized = message.toLowerCase().trim();

  for (const [category, pattern] of Object.entries(ROUTING_PATTERNS)) {
    if (pattern.test(normalized)) {
      return { category, confidence: 0.85 };
    }
  }

  return null; // Needs LLM classification
}

/**
 * Extract marketplace from message
 */
export function extractMarketplace(message: string): 'WB' | 'Ozon' | 'all' {
  const lower = message.toLowerCase();

  if (/(?:вб|wb|wildberries|вайлдберр)/i.test(lower)) return 'WB';
  if (/(?:озон|ozon)/i.test(lower)) return 'Ozon';

  return 'all';
}
