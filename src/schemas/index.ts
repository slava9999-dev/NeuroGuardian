// ============================================
// NeuroGUARDIAN — Zod Validation Schemas
// Strict validation for all API responses
// ============================================

import { z } from 'zod';

// Helper to handle Firestore Timestamps and ISO strings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zTimestamp = z.preprocess((val: any) => {
  if (val && typeof val === 'object' && '_seconds' in val) {
    return new Date(val._seconds * 1000);
  }
  return val;
}, z.coerce.date());

// ============================================
// Marketplace Enums
// ============================================
export const MarketplaceSchema = z.enum(['WB', 'Ozon']);
export const ProductStatusSchema = z.enum(['active', 'protected', 'triggered', 'disabled']);
export const DefenseModeSchema = z.enum(['zero_stock', 'price_correction']);
export const LogTypeSchema = z.enum(['price_drop', 'defense_triggered', 'sync', 'error', 'info']);

// ============================================
// WB API Response Schemas
// ============================================

// WB Content API - Cards List Response
export const WBCardSchema = z.object({
  nmID: z.number(),
  vendorCode: z.string(),
  brand: z.string().optional(),
  title: z.string().optional(),
  photos: z
    .array(
      z.object({
        big: z.string().optional(),
        c246x328: z.string().optional(),
      })
    )
    .optional(),
  sizes: z
    .array(
      z.object({
        techSize: z.string(),
        skus: z.array(z.string()),
        price: z.number().optional(),
      })
    )
    .optional(),
});

export const WBCardsListResponseSchema = z.object({
  cards: z.array(WBCardSchema).optional().default([]),
  cursor: z
    .object({
      updatedAt: z.string().optional(),
      nmID: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
});

// WB Prices API Response
export const WBPriceInfoSchema = z.object({
  nmId: z.number(),
  price: z.number(),
  discount: z.number().optional(),
  promoCode: z.number().optional(),
});

export const WBPricesResponseSchema = z.array(WBPriceInfoSchema);

// WB Stocks API Response
export const WBStockSchema = z.object({
  sku: z.string(),
  amount: z.number(),
  warehouseId: z.number(),
});

export const WBStocksResponseSchema = z.object({
  stocks: z.array(WBStockSchema),
});

// ============================================
// Ozon API Response Schemas
// ============================================

// Ozon Product List Response
export const OzonProductSchema = z.object({
  product_id: z.number(),
  offer_id: z.string(),
  name: z.string().optional(),
  barcode: z.string().optional(),
});

export const OzonProductListResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonProductSchema),
    total: z.number(),
    last_id: z.string().optional(),
  }),
});

// Ozon Product Info Response
export const OzonProductInfoSchema = z.object({
  id: z.number(),
  offer_id: z.string(),
  name: z.string(),
  barcode: z.string().optional(),
  primary_image: z.string().optional(),
  images: z.array(z.string()).optional(),
  marketing_price: z.string().optional(),
  min_price: z.string().optional(),
  price: z.string().optional(),
  stocks: z
    .object({
      present: z.number(),
      reserved: z.number(),
      101: z.number().optional(), // Often separate fields
    })
    .optional(),
});

export const OzonProductInfoResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonProductInfoSchema),
  }),
});

// Ozon Prices Response
export const OzonPriceInfoSchema = z.object({
  product_id: z.number(),
  offer_id: z.string(),
  price: z.object({
    price: z.string(),
    old_price: z.string().optional(),
    marketing_price: z.string().optional(),
    min_price: z.string().optional(),
  }),
});

export const OzonPricesResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonPriceInfoSchema),
  }),
});

// ============================================
// Internal Schemas
// ============================================

// User schema for Firestore
export const UserSchema = z.object({
  telegramId: z.number(),
  username: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  subscriptionActive: z.boolean(),
  subscriptionExpiresAt: zTimestamp.nullable(),
  subscriptionPlan: z.enum(['trial', 'basic', 'pro']).nullable(),
  protectionEnabled: z.boolean(),
  defenseMode: DefenseModeSchema,
  wbKeyRef: z.string().nullable(),
  ozonKeyRef: z.string().nullable(),
  totalProducts: z.number(),
  triggeredToday: z.number(),
  savedAmount: z.number(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
  lastActiveAt: zTimestamp,
});

// Product schema for Firestore
export const ProductSchema = z.object({
  id: z.string(),
  userId: z.number(),
  productId: z.string(),
  nmId: z.number().optional(),
  offerId: z.string().optional(),
  vendorCode: z.string(),
  barcode: z.string().optional(),
  title: z.string(),
  imageUrl: z.string(),
  brand: z.string().optional(),
  category: z.string().optional(),
  currentPrice: z.number(),
  minPrice: z.number(),
  originalPrice: z.number().optional(),
  stock: z.number(),
  marketplace: MarketplaceSchema,
  status: ProductStatusSchema,
  isMonitored: z.boolean(),
  lastCheckedAt: zTimestamp,
  lastTriggeredAt: zTimestamp.nullable(),
  createdAt: zTimestamp,
  updatedAt: zTimestamp,
});

// Log entry schema
export const LogEntrySchema = z.object({
  id: z.string(),
  userId: z.number(),
  type: LogTypeSchema,
  productId: z.string().optional(),
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  isRead: z.boolean(),
  createdAt: zTimestamp,
});

// API Key input validation
export const ApiKeyInputSchema = z.object({
  marketplace: MarketplaceSchema,
  apiKey: z.string().min(10, 'API ключ слишком короткий'),
  clientId: z.string().optional(), // Required for Ozon
});

// Min price update
export const MinPriceUpdateSchema = z.object({
  productId: z.string(),
  minPrice: z.number().min(0, 'Минимальная цена не может быть отрицательной'),
});

// Type exports from schemas
export type WBCard = z.infer<typeof WBCardSchema>;
export type WBPriceInfo = z.infer<typeof WBPriceInfoSchema>;
export type OzonProduct = z.infer<typeof OzonProductSchema>;
export type OzonProductInfo = z.infer<typeof OzonProductInfoSchema>;
export type OzonPriceInfo = z.infer<typeof OzonPriceInfoSchema>;
