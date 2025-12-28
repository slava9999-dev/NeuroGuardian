// ============================================
// NeuroGUARDIAN — Request Router
// Fast intent classification (GPT-4o-mini)
// Version: 3.0.0 | Date: December 2024
// ============================================

import { ROUTER_PROMPT, fastRoute, extractMarketplace } from './prompts/router.js';
import { RouterResultSchema, type RouterResult } from './schemas-v4.js';
import { getSecret } from '../lib/index.js';

/**
 * Router configuration
 */
const ROUTER_CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 150,
  temperature: 0.1, // Very low for consistent classification
  timeout: 5000, // 5 seconds max
};

/**
 * Specialist configuration per category
 */
export const SPECIALIST_CONFIG: Record<
  string,
  {
    model: string;
    tools: string[];
    maxTokens: number;
    temperature: number;
  }
> = {
  analytics: {
    model: 'gpt-4o',
    tools: [
      'get_products',
      'get_sales_stats',
      'get_orders',
      'get_warehouse_stocks',
      'calculate_unit_economics',
      'get_abc_analysis',
      'get_stock_forecast',
    ],
    maxTokens: 2000,
    temperature: 0.3,
  },
  pricing: {
    model: 'gpt-4o', // Critical decisions need powerful model
    tools: ['get_products', 'update_prices', 'set_stop_loss', 'bulk_protect_products'],
    maxTokens: 1500,
    temperature: 0.2, // Low for reliable tool calling
  },
  competitors: {
    model: 'gpt-4o-mini', // Search is simple
    tools: ['search_web'],
    maxTokens: 1500,
    temperature: 0.4,
  },
  sentinel: {
    model: 'gpt-4o',
    tools: ['get_products', 'set_stop_loss', 'bulk_protect_products'],
    maxTokens: 1500,
    temperature: 0.2,
  },
  stocks: {
    model: 'gpt-4o',
    tools: ['get_products', 'get_warehouse_stocks', 'update_stocks', 'get_stock_forecast'],
    maxTokens: 1500,
    temperature: 0.3,
  },
  general: {
    model: 'gpt-4o-mini', // Simple responses
    tools: [],
    maxTokens: 1000,
    temperature: 0.7,
  },
};

/**
 * Route user message to appropriate specialist
 * Uses fast pattern matching first, then LLM if needed
 */
export async function routeMessage(
  message: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<RouterResult> {
  const startTime = Date.now();

  // Step 1: Try fast pattern-based routing
  const fastResult = fastRoute(message);
  if (fastResult && fastResult.confidence >= 0.85) {
    console.log(`⚡ Fast routed to "${fastResult.category}" in ${Date.now() - startTime}ms`);
    return {
      category: fastResult.category as RouterResult['category'],
      confidence: fastResult.confidence,
      extracted_params: {
        marketplace: extractMarketplace(message),
      },
    };
  }

  // Step 2: Use LLM for complex classification
  const openaiKey = await getSecret('openai_api_key', 'router_llm_inference');

  if (!openaiKey) {
    console.warn('⚠️ No OpenAI key, falling back to general');
    return {
      category: 'general',
      confidence: 0.5,
      extracted_params: { marketplace: extractMarketplace(message) },
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ROUTER_CONFIG.timeout);

    // Build context from recent messages
    const contextMessages = conversationHistory?.slice(-3) || [];
    const contextStr =
      contextMessages.length > 0
        ? `Контекст диалога:\n${contextMessages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n`
        : '';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: ROUTER_CONFIG.model,
        messages: [
          { role: 'system', content: ROUTER_PROMPT },
          { role: 'user', content: contextStr + message },
        ],
        response_format: { type: 'json_object' },
        max_tokens: ROUTER_CONFIG.maxTokens,
        temperature: ROUTER_CONFIG.temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Router API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty router response');
    }

    const parsed = JSON.parse(content);
    const validated = RouterResultSchema.parse(parsed);

    console.log(
      `🎯 LLM routed to "${validated.category}" (${(validated.confidence * 100).toFixed(0)}%) in ${Date.now() - startTime}ms`
    );

    return validated;
  } catch (error) {
    console.error('❌ Router error:', error);

    // Fallback to pattern + general
    const marketplace = extractMarketplace(message);
    const fallbackCategory = fastResult?.category || 'general';

    return {
      category: fallbackCategory as RouterResult['category'],
      confidence: 0.5,
      extracted_params: { marketplace },
    };
  }
}

/**
 * Check if message is a confirmation response
 */
export function isConfirmation(message: string): boolean {
  const confirmPatterns = [
    /^да$/i,
    /^давай$/i,
    /^окей$/i,
    /^ок$/i,
    /^подтвержд/i,
    /^выполн/i,
    /^сделай$/i,
    /^yes$/i,
  ];

  const normalized = message.toLowerCase().trim();
  return confirmPatterns.some(p => p.test(normalized));
}

/**
 * Check if message is a rejection
 */
export function isRejection(message: string): boolean {
  const rejectPatterns = [/^нет$/i, /^отмен/i, /^не надо$/i, /^стоп$/i, /^cancel$/i, /^no$/i];

  const normalized = message.toLowerCase().trim();
  return rejectPatterns.some(p => p.test(normalized));
}

/**
 * Get specialist config for category
 */
export function getSpecialistConfig(category: string) {
  return SPECIALIST_CONFIG[category] || SPECIALIST_CONFIG.general;
}
