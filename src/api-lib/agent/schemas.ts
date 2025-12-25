// ============================================
// NeuroGUARDIAN — Agent Response Schemas
// Zod validation for structured LLM output
// Version: 3.0.0 | Date: December 2024
// ============================================

import { z } from 'zod';

// ============================================
// ROUTER SCHEMAS
// ============================================

/**
 * Router classification result
 * GPT-4o-mini classifies user intent into categories
 */
export const RouterResultSchema = z.object({
  category: z.enum([
    'analytics', // Sales, products, ABC, unit economics
    'pricing', // Price changes, stop-loss, protection
    'competitors', // Competitor research, market analysis
    'sentinel', // Sentinel status, protection settings
    'stocks', // Inventory, warehouse stocks
    'general', // Greetings, help, off-topic
  ]),
  confidence: z.number().min(0).max(1),
  extractedParams: z
    .object({
      marketplace: z.enum(['WB', 'Ozon', 'all']).optional(),
      productName: z.string().optional(),
      period: z.string().optional(),
      priceValue: z.number().optional(),
      percentage: z.number().optional(),
    })
    .optional(),
  reasoning: z.string().optional(),
});

export type RouterResult = z.infer<typeof RouterResultSchema>;

// ============================================
// AGENT RESPONSE SCHEMAS
// ============================================

/**
 * Link in agent response
 * Must be validated against whitelist
 */
export const AgentLinkSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
  source: z.enum(['search_web', 'catalog', 'manual']),
});

export type AgentLink = z.infer<typeof AgentLinkSchema>;

/**
 * Action requiring user confirmation
 */
export const AgentActionSchema = z.object({
  type: z.enum([
    'CONFIRM_PRICE_CHANGE',
    'CONFIRM_PROTECTION',
    'CONFIRM_STOCK_CHANGE',
    'SUGGEST_ANALYSIS',
    'SUGGEST_PROTECTION',
  ]),
  taskId: z.string().uuid(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()),
  expiresAt: z.number(),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;

/**
 * Main agent response schema
 * All LLM responses must conform to this structure
 */
export const AgentResponseSchema = z.object({
  // Internal reasoning (for logging, not shown to user)
  reasoning: z.string().describe('Step-by-step reasoning of the agent'),

  // User-facing response in clean Markdown
  answer: z.string().describe('User-facing response, clean Markdown, no HTML'),

  // Validated external links (only from search_web or catalog)
  links: z.array(AgentLinkSchema).default([]),

  // Action requiring user confirmation
  actionRequired: AgentActionSchema.optional(),

  // Suggested follow-up questions
  suggestions: z.array(z.string()).max(3).optional(),

  // Confidence in the response (0-1)
  confidence: z.number().min(0).max(1).default(0.8),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ============================================
// TOOL ARGUMENT SCHEMAS (enhanced)
// ============================================

/**
 * Enhanced get_products args with required marketplace
 */
export const GetProductsArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'all']).default('all'),
  limit: z.number().min(1).max(100).default(20),
  sort_by: z.enum(['price', 'stock', 'name']).optional(),
});

/**
 * Enhanced get_sales_stats args
 */
export const GetSalesStatsArgsSchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).default('all'),
});

/**
 * Enhanced update_prices args
 */
export const UpdatePricesArgsSchema = z
  .object({
    products: z
      .array(
        z.object({
          product_id: z.string(),
          new_price: z.number().positive(),
        })
      )
      .optional(),
    change_value: z.number().min(-50).max(100).optional(), // Percentage change
    marketplace: z.enum(['WB', 'Ozon']).optional(),
  })
  .refine(data => data.products || data.change_value, {
    message: 'Either products or change_value must be provided',
  });

/**
 * Enhanced set_stop_loss args
 */
export const SetStopLossArgsSchema = z
  .object({
    product_id: z.string().optional(),
    min_price: z.number().positive().optional(),
    percentage: z.number().min(1).max(50).optional(),
    marketplace: z.enum(['WB', 'Ozon']).optional(),
  })
  .refine(data => data.min_price || data.percentage, {
    message: 'Either min_price or percentage must be provided',
  });

/**
 * Enhanced bulk_protect_products args
 */
export const BulkProtectProductsArgsSchema = z.object({
  percentage: z.number().min(5).max(50).default(15),
  only_unprotected: z.boolean().default(true),
  marketplace: z.enum(['WB', 'Ozon', 'all']).default('all'),
});

/**
 * Enhanced search_web args
 */
export const SearchWebArgsEnhancedSchema = z.object({
  query: z.string().min(3).max(500),
  topic: z.enum(['competitors', 'market', 'news', 'general']).optional(),
  marketplace: z.enum(['WB', 'Ozon']).optional(),
});

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Safely parse router result with fallback
 */
export function parseRouterResult(data: unknown): RouterResult {
  try {
    return RouterResultSchema.parse(data);
  } catch (error) {
    console.warn('⚠️ Router result validation failed:', error);
    return {
      category: 'general',
      confidence: 0.5,
      extractedParams: {},
    };
  }
}

/**
 * Safely parse agent response with fallback
 */
export function parseAgentResponse(data: unknown): AgentResponse {
  try {
    return AgentResponseSchema.parse(data);
  } catch (error) {
    console.warn('⚠️ Agent response validation failed:', error);
    // Return a safe fallback
    return {
      reasoning: 'Validation failed',
      answer: typeof data === 'string' ? data : 'Произошла ошибка при обработке ответа.',
      links: [],
      confidence: 0.3,
    };
  }
}

/**
 * Validate and transform LLM JSON response
 */
export function validateLLMResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): { success: boolean; data: T; errors?: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Zod v4 uses 'issues' instead of 'errors'
  const issues = result.error.issues || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = issues.map((e: any) => `${String(e.path?.join('.') || '')}: ${e.message}`);
  console.warn('⚠️ LLM response validation errors:', errors);

  return { success: false, data: fallback, errors };
}
