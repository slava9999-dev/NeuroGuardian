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
});

export const GetSalesStatsArgsSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month', '3months']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
});

export const CalculateUnitEconomicsArgsSchema = z.object({
  product_id: z.string().optional(),
  cost_price: z.number().positive().optional(),
  marketplace: z.enum(['WB', 'Ozon']).optional(),
});

export const GetAbcAnalysisArgsSchema = z.object({
  period: z.enum(['week', 'month', '3months']).optional().default('month'),
});

export const GetStockForecastArgsSchema = z.object({
  product_id: z.string().optional(),
});

export const GetOrdersArgsSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  status: z.enum(['all', 'new', 'processing', 'delivered', 'cancelled']).optional().default('all'),
});

export const GetWarehouseStocksArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon']).optional(),
  low_stock_only: z.boolean().optional().default(false),
});

export const GetMarketplaceInfoArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'both']).optional().default('both'),
  topic: z.enum([
    'commissions',
    'logistics',
    'payments',
    'returns',
    'promotions',
    'problems',
    'tips',
    'general',
  ]),
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
});

export const UpdateStocksArgsSchema = z.object({
  products: z.array(
    z.object({
      product_id: z.string().min(1, 'Product ID is required'),
      new_stock: z.number().int().min(0, 'Stock cannot be negative'),
    })
  ),
  marketplace: z.enum(['WB', 'Ozon']),
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
export type SetStopLossArgs = z.infer<typeof SetStopLossArgsSchema>;
export type BulkProtectProductsArgs = z.infer<typeof BulkProtectProductsArgsSchema>;
export type UpdatePricesArgs = z.infer<typeof UpdatePricesArgsSchema>;
export type UpdateStocksArgs = z.infer<typeof UpdateStocksArgsSchema>;

// === VALIDATION HELPER ===

/**
 * Validate tool arguments and return typed result
 * @param schema Zod schema to validate against
 * @param args Raw arguments from OpenAI
 * @returns Validation result with parsed data or error
 */
export function validateToolArgs<T>(
  schema: z.ZodSchema<T>,
  args: unknown
): { success: true; data: T } | { success: false; error: string } {
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
