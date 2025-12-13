import { z } from 'zod';

// WB Product Schema
export const WBProductSchema = z.object({
  nmId: z.number(),
  vendorCode: z.string(),
  sizes: z.array(z.object({
    price: z.number().optional(),
    discountedPrice: z.number().optional(),
  })).optional(),
});

export const WBCardsResponseSchema = z.object({
  cards: z.array(WBProductSchema).optional().default([]),
  cursor: z.object({
    nmId: z.number().optional(),
    updatedAt: z.string().optional(),
  }).optional(),
});

// Ozon Product Schema
export const OzonProductSchema = z.object({
  product_id: z.number(),
  offer_id: z.string(),
  price: z.string(),
  old_price: z.string().optional(),
  min_price: z.string().optional(),
});

export const OzonProductListResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonProductSchema).optional().default([]),
  }),
});

// Safe parser wrapper
export function safeParseAPI<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('❌ API Validation Error:', result.error.format());
    return fallback;
  }
  return result.data;
}
