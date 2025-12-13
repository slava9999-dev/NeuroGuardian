// ============================================
// NeuroGUARDIAN — Shared Zod Schemas
// Validation for all API responses
// ============================================

import { z } from 'zod';

// ============================================
// Enums
// ============================================
export const MarketplaceSchema = z.enum(['WB', 'Ozon']);
export type Marketplace = z.infer<typeof MarketplaceSchema>;

export const ProductStatusSchema = z.enum(['active', 'protected', 'triggered', 'disabled']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const DefenseModeSchema = z.enum(['zero_stock', 'price_correction']);
export type DefenseMode = z.infer<typeof DefenseModeSchema>;

export const LogTypeSchema = z.enum(['price_drop', 'defense_triggered', 'sync', 'error', 'info']);
export type LogType = z.infer<typeof LogTypeSchema>;

// ============================================
// WB API Schemas
// ============================================

// WB Content API - Cards List
export const WBCardSchema = z.object({
  nmID: z.number(),
  vendorCode: z.string(),
  brand: z.string().optional(),
  title: z.string().optional(),
  photos: z.array(z.object({
    big: z.string().optional(),
    c246x328: z.string().optional(),
  })).optional(),
  sizes: z.array(z.object({
    techSize: z.string(),
    skus: z.array(z.string()),
    price: z.number().optional(),
  })).optional(),
});

export type WBCard = z.infer<typeof WBCardSchema>;

export const WBCardsListResponseSchema = z.object({
  cards: z.array(WBCardSchema).optional().default([]),
  cursor: z.object({
    updatedAt: z.string().optional(),
    nmID: z.number().optional(),
    total: z.number().optional(),
  }).optional(),
});

// WB Prices API
export const WBPriceInfoSchema = z.object({
  nmId: z.number(),
  price: z.number(),
  discount: z.number().optional(),
  promoCode: z.number().optional(),
});

export const WBPricesResponseSchema = z.array(WBPriceInfoSchema);

// WB Stocks API
export const WBStockSchema = z.object({
  sku: z.string(),
  amount: z.number(),
  warehouseId: z.number(),
});

export const WBStocksResponseSchema = z.object({
  stocks: z.array(WBStockSchema),
});

// WB Update Stock Request
export const WBUpdateStockRequestSchema = z.object({
  stocks: z.array(z.object({
    sku: z.string(),
    warehouseId: z.number(),
    amount: z.number(),
  })),
});

// ============================================
// Ozon API Schemas
// ============================================

// Ozon Product List
export const OzonProductItemSchema = z.object({
  product_id: z.number(),
  offer_id: z.string(),
  name: z.string().optional(),
  barcode: z.string().optional(),
});

export const OzonProductListResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonProductItemSchema),
    total: z.number(),
    last_id: z.string().optional(),
  }),
});

// Ozon Product Info
export const OzonProductInfoItemSchema = z.object({
  id: z.number(),
  offer_id: z.string(),
  name: z.string(),
  barcode: z.string().optional(),
  primary_image: z.string().optional(),
  images: z.array(z.string()).optional(),
  marketing_price: z.string().optional(),
  min_price: z.string().optional(),
  price: z.string().optional(),
  stocks: z.object({
    present: z.number(),
    reserved: z.number(),
  }).optional(),
});

export const OzonProductInfoResponseSchema = z.object({
  result: z.object({
    items: z.array(OzonProductInfoItemSchema),
  }),
});

// Ozon Prices
export const OzonPriceItemSchema = z.object({
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
    items: z.array(OzonPriceItemSchema),
  }),
});

// Ozon Update Stock Request
export const OzonUpdateStockRequestSchema = z.object({
  stocks: z.array(z.object({
    offer_id: z.string(),
    product_id: z.number(),
    stock: z.number(),
    warehouse_id: z.number(),
  })),
});

// ============================================
// Firestore Document Schemas
// ============================================

export const UserDocSchema = z.object({
  telegramId: z.number(),
  username: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  subscriptionActive: z.boolean(),
  subscriptionExpiresAt: z.date().nullable(),
  subscriptionPlan: z.enum(['trial', 'basic', 'pro']).nullable(),
  protectionEnabled: z.boolean(),
  defenseMode: DefenseModeSchema,
  wbKeyRef: z.string().nullable(),
  ozonKeyRef: z.string().nullable(),
  totalProducts: z.number(),
  triggeredToday: z.number(),
  savedAmount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastActiveAt: z.date(),
});

export type UserDoc = z.infer<typeof UserDocSchema>;

export const ProductDocSchema = z.object({
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
  lastCheckedAt: z.date(),
  lastTriggeredAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ProductDoc = z.infer<typeof ProductDocSchema>;

export const LogEntryDocSchema = z.object({
  id: z.string(),
  userId: z.number(),
  type: LogTypeSchema,
  productId: z.string().optional(),
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.unknown()),
  isRead: z.boolean(),
  createdAt: z.date(),
});

export type LogEntryDoc = z.infer<typeof LogEntryDocSchema>;

// ============================================
// Telegram Auth Schema
// ============================================

export const TelegramInitDataSchema = z.object({
  query_id: z.string().optional(),
  user: z.object({
    id: z.number(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
    is_premium: z.boolean().optional(),
    photo_url: z.string().optional(),
  }).optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export type TelegramInitData = z.infer<typeof TelegramInitDataSchema>;

// ============================================
// Cloud Tasks Payload Schemas
// ============================================

export const WorkerTaskPayloadSchema = z.object({
  userId: z.number(),
  marketplace: MarketplaceSchema.optional(),
  productIds: z.array(z.string()).optional(), // Specific products to check
  priority: z.enum(['normal', 'high']).default('normal'),
});

export type WorkerTaskPayload = z.infer<typeof WorkerTaskPayloadSchema>;

// ============================================
// API Key Input Validation
// ============================================

export const ApiKeyInputSchema = z.object({
  marketplace: MarketplaceSchema,
  apiKey: z.string().min(10, 'API ключ слишком короткий'),
  clientId: z.string().optional(), // Required for Ozon
});

export type ApiKeyInput = z.infer<typeof ApiKeyInputSchema>;

// ============================================
// Defense Action Result
// ============================================

export const DefenseActionResultSchema = z.object({
  success: z.boolean(),
  action: z.enum(['zero_stock', 'price_correction', 'none']),
  productId: z.string(),
  marketplace: MarketplaceSchema,
  oldPrice: z.number(),
  newPrice: z.number().optional(),
  oldStock: z.number().optional(),
  newStock: z.number().optional(),
  message: z.string(),
  error: z.string().optional(),
});

export type DefenseActionResult = z.infer<typeof DefenseActionResultSchema>;
