import { z } from 'zod';

export const ProductSchema = z.object({
  product_id: z.string(),
  user_id: z.number(),
  marketplace: z.enum(['WB', 'Ozon']),
  title: z.string(),
  current_price: z.number().min(0),
  min_price: z.number().min(0),
  current_stock: z.number().min(0),
  status: z.enum(['active', 'protected', 'archived', 'disabled', 'triggered']).default('active'),
  last_updated: z.string().optional(),
  metadata: z.any().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const UpdateProductPriceSchema = z.object({
  productId: z.string(),
  newPrice: z.number().positive(),
});

export const UpdateProductMinPriceSchema = z.object({
  productId: z.string(),
  minPrice: z.number().min(0),
});
