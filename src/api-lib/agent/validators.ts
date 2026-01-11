// ============================================
// NeuroGUARDIAN — AI Agent Tool Validators
// Zod schemas for runtime argument validation
// ============================================

import { z } from 'zod';

/**
 * Validation schemas for all agent tools
 * These ensure type safety at runtime and provide clear error messages
 */

// === READ-ONLY TOOLS ===

export const GetProductsArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sort_by: z.enum(['price', 'stock', 'name']).optional().default('price'),
  search: z.string().optional(), // Search by product title (partial match)
  account_id: z.number().optional(),
});

export const GetSalesStatsArgsSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month', '3months']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  account_id: z.number().optional(),
});

export const CalculateUnitEconomicsArgsSchema = z.object({
  product_id: z.string().optional(),
  cost_price: z.number().positive().optional(),
  marketplace: z.enum(['WB', 'Ozon']).optional(),
  account_id: z.number().optional(),
});

export const GetAbcAnalysisArgsSchema = z.object({
  period: z.enum(['week', 'month', '3months']).optional().default('month'),
  account_id: z.number().optional(),
});

export const GetStockForecastArgsSchema = z.object({
  product_id: z.string().optional(),
  account_id: z.number().optional(),
});

export const GetOrdersArgsSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  status: z.enum(['all', 'new', 'processing', 'delivered', 'cancelled']).optional().default('all'),
  account_id: z.number().optional(),
});

export const GetWarehouseStocksArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon']).optional(),
  low_stock_only: z.boolean().optional().default(false),
  account_id: z.number().optional(),
});

export const GetMarketplaceInfoArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'both']).optional().default('both'),
  topic: z.enum(['commissions', 'logistics', 'promotions', 'legal', 'tips', 'problems', 'general']),
});

export const SearchWebArgsSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  topic: z.enum(['competitors', 'market', 'news', 'general']).optional().default('general'),
});

export const GetCompetitorPriceArgsSchema = z.object({
  nm_id: z.union([z.string(), z.number()]).transform(val => String(val)),
  marketplace: z.enum(['WB', 'Ozon']).optional().default('WB'),
});

export const GetMarketplaceAccountsArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
});

export const GetSystemLogsArgsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  entity_type: z.string().optional(),
  user_id: z.number().optional(),
});

export const GetReviewsArgsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  is_replied: z.boolean().optional(),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  product_id: z.string().optional(),
});

export const GetLowMarginProductsArgsSchema = z.object({
  threshold: z.number().min(-100).max(100).optional().default(10), // Alert if margin < threshold
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  account_id: z.number().optional(),
});

export const GenerateReviewReplyArgsSchema = z.object({
  review_id: z.string().min(1, 'Review ID is required'),
  marketplace: z.enum(['WB', 'Ozon']),
  tone: z.enum(['polite', 'friendly', 'official']).optional().default('polite'),
  text: z.string().optional(), // If provided, use this text
});

// === WRITE TOOLS (REQUIRE CONFIRMATION) ===

export const SetStopLossArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  min_price: z.number().positive('Minimum price must be positive').optional(),
  percentage: z
    .number()
    .min(1, 'Percentage must be at least 1%')
    .max(50, 'Percentage cannot exceed 50%')
    .optional(),
});

export const BulkProtectProductsArgsSchema = z.object({
  percentage: z
    .number()
    .min(5, 'Percentage must be at least 5%')
    .max(50, 'Percentage cannot exceed 50%'),
  only_unprotected: z.boolean().optional().default(true),
});

export const UpdatePricesArgsSchema = z.object({
  products: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Product ID is required'),
        new_price: z.number().positive('Price must be positive'),
      })
    )
    .optional(),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  change_value: z
    .number()
    .min(-50, 'Cannot decrease by more than 50%')
    .max(100, 'Cannot increase by more than 100%')
    .optional(),
  account_id: z.number().optional(),
});

export const UpdateStocksArgsSchema = z.object({
  products: z.array(
    z.object({
      product_id: z.string().min(1, 'Product ID is required'),
      new_stock: z.number().int().min(0, 'Stock cannot be negative'),
    })
  ),
  marketplace: z.enum(['WB', 'Ozon']),
  account_id: z.number().optional(),
});

export const UpdateProductSettingsArgsSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  cost_price: z.number().int().min(0).optional(),
  category: z.string().optional(),
  min_price: z.number().int().min(0).optional(),
  is_monitored: z.boolean().optional(),
});

// === CONFIRMATION DETAILS SCHEMAS (for handleConfirmation) ===

/** Schema for validated price change item */
export const PriceChangeItemSchema = z.object({
  product_id: z.string().min(1),
  nm_id: z.number().nullable().optional(),
  title: z.string().optional(),
  marketplace: z.enum(['WB', 'Ozon']),
  currentPrice: z.number().positive(),
  newPrice: z.number().positive(),
});

/** Schema for update_prices confirmation details */
export const UpdatePricesDetailsSchema = z.object({
  price_changes: z.array(PriceChangeItemSchema).min(1, 'At least one price change required'),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional(),
});

/** Schema for validated stock change item */
export const StockChangeItemSchema = z.object({
  product_id: z.string().optional(),
  sku: z.string().optional(),
  offer_id: z.string().optional(),
  new_stock: z.number().int().min(0),
  marketplace: z.enum(['WB', 'Ozon']).optional(),
});

/** Schema for update_stocks confirmation details */
export const UpdateStocksDetailsSchema = z.object({
  stock_changes: z.array(StockChangeItemSchema).min(1, 'At least one stock change required'),
  marketplace: z.enum(['WB', 'Ozon']),
});

/** Schema for set_stop_loss confirmation details */
export const SetStopLossDetailsSchema = z.object({
  product_id: z.string().min(1),
  min_price: z.number().positive(),
});

/** Schema for bulk_protect_products confirmation details */
export const BulkProtectDetailsSchema = z.object({
  percentage: z.number().min(1).max(50),
  only_unprotected: z.boolean().optional(),
  products: z
    .array(
      z.object({
        product_id: z.string(),
        min_price: z.number().positive(),
      })
    )
    .optional(),
});

// === TYPE EXPORTS ===

export type GetProductsArgs = z.infer<typeof GetProductsArgsSchema>;
export type GetSalesStatsArgs = z.infer<typeof GetSalesStatsArgsSchema>;
export type CalculateUnitEconomicsArgs = z.infer<typeof CalculateUnitEconomicsArgsSchema>;
export type GetAbcAnalysisArgs = z.infer<typeof GetAbcAnalysisArgsSchema>;
export type GetStockForecastArgs = z.infer<typeof GetStockForecastArgsSchema>;
export type GetOrdersArgs = z.infer<typeof GetOrdersArgsSchema>;
export type GetWarehouseStocksArgs = z.infer<typeof GetWarehouseStocksArgsSchema>;
export type GetMarketplaceInfoArgs = z.infer<typeof GetMarketplaceInfoArgsSchema>;
export type SearchWebArgs = z.infer<typeof SearchWebArgsSchema>;
export type GetCompetitorPriceArgs = z.infer<typeof GetCompetitorPriceArgsSchema>;
export type SetStopLossArgs = z.infer<typeof SetStopLossArgsSchema>;
export type BulkProtectProductsArgs = z.infer<typeof BulkProtectProductsArgsSchema>;
export type UpdatePricesArgs = z.infer<typeof UpdatePricesArgsSchema>;
export type UpdateStocksArgs = z.infer<typeof UpdateStocksArgsSchema>;
export type GetMarketplaceAccountsArgs = z.infer<typeof GetMarketplaceAccountsArgsSchema>;
export type GetSystemLogsArgs = z.infer<typeof GetSystemLogsArgsSchema>;
export type GetLowMarginProductsArgs = z.infer<typeof GetLowMarginProductsArgsSchema>;
export type GetReviewsArgs = z.infer<typeof GetReviewsArgsSchema>;
export type GenerateReviewReplyArgs = z.infer<typeof GenerateReviewReplyArgsSchema>;
export type UpdateProductSettingsArgs = z.infer<typeof UpdateProductSettingsArgsSchema>;

// Confirmation details types
export type PriceChangeItem = z.infer<typeof PriceChangeItemSchema>;
export type UpdatePricesDetails = z.infer<typeof UpdatePricesDetailsSchema>;
export type StockChangeItem = z.infer<typeof StockChangeItemSchema>;
export type UpdateStocksDetails = z.infer<typeof UpdateStocksDetailsSchema>;
export type SetStopLossDetails = z.infer<typeof SetStopLossDetailsSchema>;
export type BulkProtectDetails = z.infer<typeof BulkProtectDetailsSchema>;

// === VALIDATION HELPER ===
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Type guard to check if validation failed
 * This ensures TypeScript correctly narrows the type across different TS versions
 */
export function isValidationError<T>(
  result: ValidationResult<T>
): result is { success: false; error: string } {
  return result.success === false;
}

/**
 * Validate tool arguments and return typed result
 * @param schema Zod schema to validate against
 * @param args Raw arguments from OpenAI
 * @returns Validation result with parsed data or error
 */
export function validateToolArgs<T>(schema: z.ZodSchema<T>, args: unknown): ValidationResult<T> {
  const result = schema.safeParse(args);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into user-friendly message
  const errorMessages = result.error.issues
    .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
    .join('; ');

  return {
    success: false,
    error: `Неверные параметры: ${errorMessages}`,
  };
}
