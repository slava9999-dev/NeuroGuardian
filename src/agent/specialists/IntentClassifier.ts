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
Analyze the user query and classify it into ONE of these 5 categories:

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

**CHAT** — Greetings, FAQ, help, general questions
Examples:
- "привет"
- "что ты умеешь"
- "помощь"
- "как работает Sentinel"
- "как добавить ключи"

## ENTITY EXTRACTION:
Also extract:
- productIds: any article numbers (5+ digit numbers)
- prices: any price mentions (numbers with ₽ or "рублей")
- marketplace: "WB" or "Ozon" if mentioned

## OUTPUT FORMAT:
Valid JSON only, no markdown:
{"category": "PRODUCTS|PRICING|SENTINEL|ANALYTICS|CHAT", "confidence": 0.0-1.0, "reasoning": "brief explanation", "entities": {"productIds": [], "prices": [], "marketplace": null}}`;

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

  // CHAT patterns (greetings, help)
  const chatPatterns = [
    /^(привет|здравствуй|хай|hello|hi|hey|добр)/i,
    /^(кто ты|что умеешь|help|помощь|помоги|как работает)/i,
    /^(как дела|спасибо|пока|bye)/i,
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

  // PRICING patterns
  const pricingPatterns = [
    /(стоп.?лосс|stop.?loss)/i,
    /(измен|обнов|устанор|поставь|сделай).*(цен|price)/i,
    /(защит[иь]).*(товар|все|массов)/i,
    /(минимальн|мин).*(цен|порог)/i,
    /bulk.?protect/i,
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

  // SENTINEL patterns
  const sentinelPatterns = [
    /(угроз|threat)/i,
    /(конкурент|competitor)/i,
    /(sentinel|сентинел|страж|защита)/i,
    /(статус защит)/i,
    /(мониторинг цен)/i,
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

  // ANALYTICS patterns
  const analyticsPatterns = [
    /(юнит|unit).*(эконом|econom)/i,
    /(abc|абс).*(анализ|analysis)/i,
    /(прогноз|forecast)/i,
    /(статистик|stats)/i,
    /(заработ|прибыл|доход|revenue|profit)/i,
    /(рентабельн|margin|маржа)/i,
    /(продаж|sales).*(за|анализ|статистик)/i,
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

  // PRODUCTS patterns
  const productsPatterns = [
    /(товар|product|артикул|sku)/i,
    /(покажи|список|найди|поиск).*(товар)/i,
    /(синхронизир|sync)/i,
    /(низк).*(марж)/i,
    /(реальн).*(цен)/i,
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
    const llm = new GeminiProvider({ model: 'gemini-2.5-flash', temperature: 0 });

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
