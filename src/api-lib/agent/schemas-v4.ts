// ============================================
// NeuroGUARDIAN — Agent V4 Schemas
// Structured Output schemas for two-phase pipeline
// Version: 4.0.0 | Date: December 2024
// ============================================

import { z } from 'zod';

// ============================================
// PHASE 1: PLANNER SCHEMAS
// ============================================

/**
 * Available tools that planner can request
 */
export const ToolNameEnum = z.enum([
  'get_products',
  'get_sales_stats',
  'get_orders',
  'get_warehouse_stocks',
  'calculate_unit_economics',
  'get_abc_analysis',
  'get_stock_forecast',
  'get_marketplace_info',
  'get_marketplace_accounts',
  'get_competitor_price',
  'search_web',
  'update_prices',
  'update_stocks',
  'set_stop_loss',
  'bulk_protect_products',
  'get_system_logs',
  'get_reviews',
  'get_low_margin_products',
]);

export type ToolName = z.infer<typeof ToolNameEnum>;

/**
 * Single tool call in the plan
 */
export const PlannedToolSchema = z.object({
  tool: ToolNameEnum,
  args: z.record(z.string(), z.unknown()).describe('Arguments for the tool'),
  reason: z.string().describe('Why this tool is needed'),
});

/**
 * Planner output: list of tools to execute
 */
export const PlanSchema = z.object({
  reasoning: z.string().describe('Step-by-step reasoning for the plan'),
  tools: z.array(PlannedToolSchema).describe('Tools to execute in order'),
  requires_confirmation: z.boolean().default(false).describe('Does this plan modify data?'),
});

export type Plan = z.infer<typeof PlanSchema>;

// ============================================
// PHASE 2: ANSWERER SCHEMAS
// ============================================

/**
 * Link in the response - MUST come from tool results
 */
export const ResponseLinkSchema = z.object({
  title: z.string().describe('Display text for the link'),
  url: z.string().url().describe('Valid URL from tool results'),
  source: z
    .enum(['search_web', 'marketplace', 'documentation'])
    .describe('Where this link came from'),
});

/**
 * Action that requires user confirmation
 */
export const ResponseActionSchema = z.object({
  type: z.enum([
    'update_prices',
    'set_stop_loss',
    'bulk_protect_products',
    'update_stocks',
    'navigation',
  ]),
  summary: z.string().describe('Human-readable description'),
  details_json: z.string().describe('JSON-serialized action parameters'),
  affected_count: z.number().int().min(0).describe('Number of items affected'),
});

/**
 * Structured data for UI rendering
 */
export const ResponseDataSchema = z.object({
  type: z.enum([
    'products_list',
    'sales_stats',
    'orders_list',
    'stocks_list',
    'unit_economics',
    'abc_analysis',
    'stock_forecast',
    'competitors',
    'marketplace_info',
  ]),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  summary: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Final answer schema - what Answerer LLM returns
 */
export const AnswerSchema = z.object({
  message: z.string().describe('Response text in plain markdown, NO HTML tags'),
  links: z.array(ResponseLinkSchema).optional().describe('Links from tool results only'),
  actions: z.array(ResponseActionSchema).optional().describe('Actions requiring confirmation'),
  data_json: z.string().optional().describe('JSON-serialized structured data for UI'),
});

export type Answer = z.infer<typeof AnswerSchema>;

// ============================================
// ROUTER SCHEMAS
// ============================================

/**
 * Intent categories for routing
 */
export const IntentCategoryEnum = z.enum([
  'analytics', // Sales, stats, reports
  'pricing', // Price changes, stop-loss
  'products', // Product info, stocks
  'competitors', // Competitor research
  'general', // FAQ, help, greetings
  'confirmation', // Yes/No responses
]);

export type IntentCategory = z.infer<typeof IntentCategoryEnum>;

/**
 * Router output
 */
export const RouterResultSchema = z.object({
  category: IntentCategoryEnum,
  confidence: z.number().min(0).max(1),
  extracted_params: z
    .object({
      marketplace: z.enum(['WB', 'Ozon', 'all']).optional(),
      product_id: z.string().optional(),
      time_period: z.string().optional(),
    })
    .optional(),
});

export type RouterResult = z.infer<typeof RouterResultSchema>;

// ============================================
// TOOL RESULTS SCHEMA (for validation)
// ============================================

/**
 * Search result from search_web tool
 */
export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
});

/**
 * Aggregated tool results passed to Answerer
 */
export const ToolResultsSchema = z.object({
  tool: ToolNameEnum,
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  urls: z.array(z.string().url()).optional().describe('All URLs from this tool result'),
});

export type ToolResult = z.infer<typeof ToolResultsSchema>;

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that all links in answer exist in tool results
 */
export function validateAnswerLinks(
  answer: Answer,
  toolResults: ToolResult[]
): { valid: boolean; invalidLinks: string[] } {
  if (!answer.links || answer.links.length === 0) {
    return { valid: true, invalidLinks: [] };
  }

  // Collect all URLs from tool results
  const validUrls = new Set<string>();
  for (const result of toolResults) {
    if (result.urls) {
      for (const url of result.urls) {
        validUrls.add(url);
        // Also add normalized versions
        try {
          const parsed = new URL(url);
          validUrls.add(parsed.href);
        } catch {
          // Invalid URL, skip
        }
      }
    }
    // Extract URLs from search_web data
    if (result.tool === 'search_web' && result.data) {
      const data = result.data as { results?: Array<{ link?: string }> };
      if (data.results) {
        for (const r of data.results) {
          if (r.link) {
            validUrls.add(r.link);
          }
        }
      }
    }
  }

  const invalidLinks: string[] = [];
  for (const link of answer.links) {
    if (!validUrls.has(link.url)) {
      invalidLinks.push(link.url);
    }
  }

  return {
    valid: invalidLinks.length === 0,
    invalidLinks,
  };
}

/**
 * Strip invalid links from answer
 */
export function sanitizeAnswerLinks(answer: Answer, toolResults: ToolResult[]): Answer {
  const validation = validateAnswerLinks(answer, toolResults);

  if (validation.valid) {
    return answer;
  }

  console.warn(
    `🚫 Removed ${validation.invalidLinks.length} hallucinated links:`,
    validation.invalidLinks
  );

  return {
    ...answer,
    links: answer.links?.filter(link => !validation.invalidLinks.includes(link.url)),
  };
}

// ============================================
// JSON SCHEMA FOR OPENAI STRUCTURED OUTPUT
// ============================================

/**
 * OpenAI Structured Output format for Answer
 * Use with response_format: { type: "json_schema", json_schema: ANSWER_JSON_SCHEMA }
 */
export const ANSWER_JSON_SCHEMA = {
  name: 'agent_response',
  strict: false, // links, actions, data_json are optional
  schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Response text in plain markdown, NO HTML tags',
      },
      links: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            source: { type: 'string', enum: ['search_web', 'marketplace', 'documentation'] },
          },
          required: ['title', 'url', 'source'],
          additionalProperties: false,
        },
        description: 'Links from tool results only',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'update_prices',
                'set_stop_loss',
                'bulk_protect_products',
                'update_stocks',
                'navigation',
              ],
            },
            summary: { type: 'string' },
            details_json: {
              type: 'string',
              description: 'JSON-serialized details object',
            },
            affected_count: { type: 'integer' },
          },
          required: ['type', 'summary', 'details_json', 'affected_count'],
          additionalProperties: false,
        },
      },
      data_json: {
        type: 'string',
        description: 'JSON-serialized data object with type, items, summary',
      },
    },
    required: ['message'],
    additionalProperties: false,
  },
};

/**
 * OpenAI Structured Output format for Plan
 */
export const PLAN_JSON_SCHEMA = {
  name: 'execution_plan',
  strict: false, // Cannot use strict: args properties are optional
  schema: {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Step-by-step reasoning for the plan',
      },
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tool: {
              type: 'string',
              enum: [
                'get_products',
                'get_sales_stats',
                'get_orders',
                'get_warehouse_stocks',
                'calculate_unit_economics',
                'get_abc_analysis',
                'get_stock_forecast',
                'get_marketplace_info',
                'get_marketplace_accounts',
                'get_competitor_price',
                'search_web',
                'update_prices',
                'update_stocks',
                'set_stop_loss',
                'bulk_protect_products',
                'get_system_logs',
                'get_reviews',
                'get_low_margin_products',
              ],
            },
            args: {
              type: 'object',
              properties: {
                account_id: {
                  type: 'integer',
                  description: 'ID конкретной учетной записи маркетплейса',
                },
                marketplace: {
                  type: 'string',
                  enum: ['WB', 'Ozon', 'all'],
                  description: 'Marketplace filter',
                },
                period: {
                  type: 'string',
                  enum: ['today', 'yesterday', 'week', 'month', '3months'],
                  description: 'Time period',
                },
                limit: {
                  type: 'integer',
                  description: 'Max items to return',
                },
                sort_by: {
                  type: 'string',
                  enum: ['price', 'stock', 'name'],
                  description: 'Sort order',
                },
                product_id: {
                  type: 'string',
                  description: 'Product ID or name',
                },
                cost_price: {
                  type: 'number',
                  description: 'Cost price in RUB',
                },
                new_price: {
                  type: 'number',
                  description: 'New price in RUB',
                },
                new_stock: {
                  type: 'integer',
                  description: 'New stock quantity',
                },
                min_price: {
                  type: 'number',
                  description: 'Minimum price for stop-loss',
                },
                percentage: {
                  type: 'number',
                  description: 'Percentage value',
                },
                only_unprotected: {
                  type: 'boolean',
                  description: 'Only unprotected products',
                },
                products: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      product_id: { type: 'string' },
                      new_price: { type: 'number' },
                      new_stock: { type: 'integer' },
                    },
                  },
                },
                change_value: {
                  type: 'number',
                  description: 'Percentage change',
                },
                topic: {
                  type: 'string',
                  enum: [
                    'commissions',
                    'logistics',
                    'promotions',
                    'legal',
                    'tips',
                    'problems',
                    'general',
                  ],
                  description: 'Info topic',
                },
                query: {
                  type: 'string',
                  description: 'Search query',
                },
                status: {
                  type: 'string',
                  enum: ['all', 'new', 'processing', 'delivered', 'cancelled'],
                  description: 'Order status',
                },
                low_stock_only: {
                  type: 'boolean',
                  description: 'Only low stock items',
                },
                severity: {
                  type: 'string',
                  enum: ['info', 'warning', 'error', 'critical'],
                  description: 'Log severity level',
                },
                nm_id: {
                  type: 'string',
                  description: 'Артикул товара конкурента (nm_id для WB)',
                },
                is_replied: {
                  type: 'boolean',
                  description: 'Filter reviews by reply status',
                },
                entity_type: {
                  type: 'string',
                  description: 'Entity type filter (e.g. user, product)',
                },
                threshold: {
                  type: 'number',
                  description: 'Margin threshold percentage (default 10)',
                },
              },
              required: [], // All args are optional
              additionalProperties: false,
            },
            reason: { type: 'string' },
          },
          required: ['tool', 'args', 'reason'],
          additionalProperties: false,
        },
      },
      requires_confirmation: {
        type: 'boolean',
        description: 'Does this plan modify data?',
      },
    },
    required: ['reasoning', 'tools', 'requires_confirmation'],
    additionalProperties: false,
  },
};
