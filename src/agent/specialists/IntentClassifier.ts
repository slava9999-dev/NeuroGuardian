// ============================================
// NeuroGUARDIAN — Intent Classifier v2
// Enhanced classification with 5 categories
// Uses Gemini 2.5 Flash for fast routing
// Version: 2.0.0 | Date: January 2026
// ============================================

import { GeminiProvider } from '../../infrastructure/llm/GeminiProvider.js';
import { logger } from '../../api-lib/lib/logger.js';

export type IntentCategory = 'PRODUCTS' | 'PRICING' | 'SENTINEL' | 'ANALYTICS' | 'CHAT';

export interface ClassificationResult {
  category: IntentCategory;
  confidence: number;
  reasoning: string;
  entities: {
    productIds?: string[];
    prices?: number[];
    marketplace?: 'WB' | 'Ozon';
  };
  latencyMs: number;
  classifiedBy: 'llm' | 'rules';
}

const CLASSIFICATION_PROMPT = `You are an intent classifier for NeuroGUARDIAN marketplace management system.
Analyze the user query and classify it into ONE of these 6 categories:

## CATEGORIES:

**PRODUCTS** — Product queries, search, sync, settings
Examples:
- "покажи мои товары"
- "найди товар 123456"
- "синхронизируй товары"
- "какие товары на WB"
- "товары с низкой маржой"

**PRICING** — Price changes, stop-loss, bulk protection
Examples:
- "установи стоп-лосс 500"
- "измени цену на 1000"
- "защити все товары"
- "обнови цены"
- "массовая защита"

**SENTINEL** — Threats, competitors, protection status
Examples:
- "какие угрозы"
- "статус защиты"
- "конкуренты"
- "цены конкурентов"
- "Sentinel статус"

**ANALYTICS** — Unit economics, ABC analysis, forecasts, stats
Examples:
- "юнит-экономика"
- "ABC анализ"
- "прогноз продаж"
- "статистика за месяц"
- "сколько заработал"
- "рентабельность"

**CHAT** — Greetings, help, general questions (not support related)

## ENTITY EXTRACTION:
Also extract:
- productIds: any article numbers (5+ digit numbers)
- prices: any price mentions (numbers with ₽ or "рублей")
- marketplace: "WB" or "Ozon" if mentioned

## OUTPUT FORMAT:
Valid JSON only, no markdown:
{"category": "PRODUCTS|PRICING|SENTINEL|ANALYTICS|CHAT", "confidence": 0.0-1.0, "reasoning": "summary", "entities": {"productIds": [], "prices": [], "marketplace": null}}`;

/**
 * Rule-based fallback classifier
 */
function classifyByRules(query: string): ClassificationResult {
  const lowerQuery = query.toLowerCase();
  const startTime = Date.now();

  // Extract entities first
  const productIds = query.match(/\b\d{5,}\b/g) || [];
  const priceMatches = query.match(/\b\d+\s*(₽|руб|рублей)/gi) || [];
  const prices = priceMatches.map(p => parseInt(p.replace(/\D/g, '')));

  // Explicitly type marketplace to match ClassificationResult.entities.marketplace
  const marketplace: 'WB' | 'Ozon' | undefined =
    lowerQuery.includes('wb') || lowerQuery.includes('wildberries')
      ? 'WB'
      : lowerQuery.includes('ozon') || lowerQuery.includes('озон')
        ? 'Ozon'
        : undefined;

  const baseResult = {
    entities: {
      productIds: productIds.length > 0 ? productIds : undefined,
      prices: prices.length > 0 ? prices : undefined,
      marketplace,
    },
    latencyMs: Date.now() - startTime,
    classifiedBy: 'rules' as const,
  };

  // CHAT patterns (greetings, help, FAQ)
  const chatPatterns = [
    /^(привет|здравствуй|хай|hello|hi|hey|добр|салют|дарова)/i,
    /^(кто ты|что умеешь|help|помощь|помоги|как работает|что это|зачем|какая модель|модель|версия)/i,
    /^(как дела|спасибо|пока\b|bye|благодар|круто|супер|отлично)/i,
    /^(как подключить|как настроить|инструкция|обучение|начать)/i,
    /^(подписка|тариф|стоимость|сколько стоит|цена услуг)/i,
  ];

  for (const pattern of chatPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        ...baseResult,
        category: 'CHAT',
        confidence: 0.9,
        reasoning: 'Rule: greeting/help pattern matched',
      };
    }
  }

  // PRICING patterns (price changes, stop-loss, protection)
  const pricingPatterns = [
    /(стоп.?лосс|stop.?loss|стоплосс)/i,
    /(измен|обнов|устанор|поставь|сделай|подним|сниз).*(цен|price)/i,
    /(защит[иь]|защита).*(товар|все|массов|цен)/i,
    /(минимальн|мин).*(цен|порог)/i,
    /bulk.?protect/i,
    /(установ|задай|выстав).*(защит|лимит|порог|мин)/i,
    /(включ|активир).*(защит|sentinel)/i,
  ];

  for (const pattern of pricingPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        ...baseResult,
        category: 'PRICING',
        confidence: 0.85,
        reasoning: 'Rule: pricing pattern matched',
      };
    }
  }

  // SENTINEL patterns (threats, competitors, monitoring)
  const sentinelPatterns = [
    /(угроз|threat|опасност|атак)/i,
    /(конкурент|competitor|соперник)/i,
    /(sentinel|сентинел|страж)/i,
    /(статус защит|как защита|работает защита)/i,
    /(мониторинг цен|слеж|отслежива)/i,
    /(лог|история|журнал).*(защит|sentinel|срабатыван)/i,
    /(цен).*(конкурент|сопорник)/i,
    /(сравн|анализ).*(конкурент)/i,
  ];

  for (const pattern of sentinelPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        ...baseResult,
        category: 'SENTINEL',
        confidence: 0.85,
        reasoning: 'Rule: sentinel pattern matched',
      };
    }
  }

  // ANALYTICS patterns (economics, analysis, forecasts)
  const analyticsPatterns = [
    /(юнит|unit).*(эконом|econom)/i,
    /(abc|абс|абц).*(анализ|analysis)/i,
    /(прогноз|forecast|предсказ)/i,
    /(статистик|stats|отчёт|отчет)/i,
    /(заработ|прибыл|доход|revenue|profit|выручк)/i,
    /(рентабельн|margin|маржа|маржинальн)/i,
    /(продаж|sales).*(за|анализ|статистик|отчёт)/i,
    /(себестоимост|расход|затрат)/i,
    /(сколько|какой|какая).*(прибыл|доход|заработ|маржа)/i,
    /(посчита|рассчита|калькул).*(эконом|прибыл|маржа)/i,
  ];

  for (const pattern of analyticsPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        ...baseResult,
        category: 'ANALYTICS',
        confidence: 0.85,
        reasoning: 'Rule: analytics pattern matched',
      };
    }
  }

  // PRODUCTS patterns (products, search, sync)
  const productsPatterns = [
    /(товар|product|артикул|sku|позиц)/i,
    /(покажи|список|найди|поиск|где).*(товар)/i,
    /(синхронизир|sync|обнов|импорт).*(товар|каталог)/i,
    /(низк|мал).*(марж|маржинальн)/i,
    /(реальн|итогов|финальн).*(цен)/i,
    /(мои|мой|все).*(товар|позиц)/i,
    /(сколько|количество).*(товар|позиц)/i,
    /(настро|измен).*(товар|позиц)/i,
  ];

  for (const pattern of productsPatterns) {
    if (pattern.test(lowerQuery)) {
      return {
        ...baseResult,
        category: 'PRODUCTS',
        confidence: 0.8,
        reasoning: 'Rule: products pattern matched',
      };
    }
  }

  // Default to CHAT (safer fallback for unknown intents)
  return {
    ...baseResult,
    category: 'CHAT',
    confidence: 0.5,
    reasoning: 'Rule: no pattern matched, defaulting to CHAT',
  };
}

/**
 * LLM-based classifier using Gemini Flash
 */
async function classifyWithLLM(query: string): Promise<ClassificationResult | null> {
  const startTime = Date.now();

  try {
    const llm = new GeminiProvider({ model: 'gemini-2.0-flash', temperature: 0 });

    const response = await llm.complete([
      {
        role: 'system',
        content: CLASSIFICATION_PROMPT,
      },
      {
        role: 'user',
        content: `Classify this query: "${query}"`,
      },
    ]);

    const content = response.content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(content);

    const latencyMs = Date.now() - startTime;

    // Validate category
    const validCategories: IntentCategory[] = [
      'PRODUCTS',
      'PRICING',
      'SENTINEL',
      'ANALYTICS',
      'CHAT',
    ];
    if (!validCategories.includes(parsed.category)) {
      throw new Error(`Invalid category: ${parsed.category}`);
    }

    logger.info('[IntentClassifier] LLM classification', {
      category: parsed.category,
      confidence: parsed.confidence,
      latencyMs,
    });

    return {
      category: parsed.category as IntentCategory,
      confidence: parsed.confidence || 0.8,
      reasoning: parsed.reasoning || 'LLM classification',
      entities: parsed.entities || {},
      latencyMs,
      classifiedBy: 'llm',
    };
  } catch (error) {
    logger.warn('[IntentClassifier] LLM classification failed', {
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    });
    return null;
  }
}

/**
 * Main classification function
 * Strategy: LLM first → Rules fallback
 */
export async function classifyIntent(query: string): Promise<ClassificationResult> {
  // Try LLM classification first (if API key available)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    const llmResult = await classifyWithLLM(query);
    if (llmResult && llmResult.confidence >= 0.6) {
      return llmResult;
    }
  }

  // Fallback to rules
  return classifyByRules(query);
}

/**
 * Quick rule-based classification (for performance-critical paths)
 */
export function classifyIntentSync(query: string): ClassificationResult {
  return classifyByRules(query);
}
