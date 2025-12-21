import { z } from 'zod';

// Tool Arguments Validation Schemas

export const GetProductsArgsSchema = z.object({
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
  limit: z.number().optional().default(20),
  sort_by: z.enum(['price', 'stock', 'name']).optional(),
});

export const CalculateUnitEconomicsArgsSchema = z.object({
  product_id: z.string().optional(),
  cost_price: z.number().optional(),
  marketplace: z.enum(['WB', 'Ozon']).optional().default('WB'),
});

export const GetSalesStatsArgsSchema = z.object({
  period: z.enum(['today', 'yesterday', 'week', 'month', '3months']),
  marketplace: z.enum(['WB', 'Ozon', 'all']).optional().default('all'),
});

export const SetStopLossArgsSchema = z
  .object({
    product_id: z.string(),
    min_price: z.number().optional(),
    percentage: z.number().optional(),
  })
  .refine(data => data.min_price !== undefined || data.percentage !== undefined, {
    message: 'Either min_price or percentage must be provided',
  });

export const BulkProtectArgsSchema = z.object({
  percentage: z.number().min(5).max(50),
  only_unprotected: z.boolean().optional(),
});

export const UpdatePricesArgsSchema = z
  .object({
    product_ids: z.array(z.string()),
    price_change: z.number().optional(),
    price_change_percent: z.number().optional(),
  })
  .refine(data => data.price_change !== undefined || data.price_change_percent !== undefined, {
    message: 'Either price_change or price_change_percent must be provided',
  });

export const AgentMessageSchema = z.object({
  userId: z.number(),
  message: z.string().min(1).max(2000),
  userContext: z.record(z.string(), z.any()),
});
