"use strict";
// ============================================
// NeuroGUARDIAN — Shared Zod Schemas
// Validation for all API responses
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefenseActionResultSchema = exports.ApiKeyInputSchema = exports.WorkerTaskPayloadSchema = exports.TelegramInitDataSchema = exports.LogEntryDocSchema = exports.ProductDocSchema = exports.UserDocSchema = exports.OzonUpdateStockRequestSchema = exports.OzonPricesResponseSchema = exports.OzonPriceItemSchema = exports.OzonProductInfoResponseSchema = exports.OzonProductInfoItemSchema = exports.OzonProductListResponseSchema = exports.OzonProductItemSchema = exports.WBUpdateStockRequestSchema = exports.WBStocksResponseSchema = exports.WBStockSchema = exports.WBPricesResponseSchema = exports.WBPriceInfoSchema = exports.WBCardsListResponseSchema = exports.WBCardSchema = exports.LogTypeSchema = exports.DefenseModeSchema = exports.ProductStatusSchema = exports.MarketplaceSchema = void 0;
const zod_1 = require("zod");
// ============================================
// Enums
// ============================================
exports.MarketplaceSchema = zod_1.z.enum(['WB', 'Ozon']);
exports.ProductStatusSchema = zod_1.z.enum(['active', 'protected', 'triggered', 'disabled']);
exports.DefenseModeSchema = zod_1.z.enum(['zero_stock', 'price_correction']);
exports.LogTypeSchema = zod_1.z.enum(['price_drop', 'defense_triggered', 'sync', 'error', 'info']);
// ============================================
// WB API Schemas
// ============================================
// WB Content API - Cards List
exports.WBCardSchema = zod_1.z.object({
    nmID: zod_1.z.number(),
    vendorCode: zod_1.z.string(),
    brand: zod_1.z.string().optional(),
    title: zod_1.z.string().optional(),
    photos: zod_1.z.array(zod_1.z.object({
        big: zod_1.z.string().optional(),
        c246x328: zod_1.z.string().optional(),
    })).optional(),
    sizes: zod_1.z.array(zod_1.z.object({
        techSize: zod_1.z.string(),
        skus: zod_1.z.array(zod_1.z.string()),
        price: zod_1.z.number().optional(),
    })).optional(),
});
exports.WBCardsListResponseSchema = zod_1.z.object({
    cards: zod_1.z.array(exports.WBCardSchema).optional().default([]),
    cursor: zod_1.z.object({
        updatedAt: zod_1.z.string().optional(),
        nmID: zod_1.z.number().optional(),
        total: zod_1.z.number().optional(),
    }).optional(),
});
// WB Prices API
exports.WBPriceInfoSchema = zod_1.z.object({
    nmId: zod_1.z.number(),
    price: zod_1.z.number(),
    discount: zod_1.z.number().optional(),
    promoCode: zod_1.z.number().optional(),
});
exports.WBPricesResponseSchema = zod_1.z.array(exports.WBPriceInfoSchema);
// WB Stocks API
exports.WBStockSchema = zod_1.z.object({
    sku: zod_1.z.string(),
    amount: zod_1.z.number(),
    warehouseId: zod_1.z.number(),
});
exports.WBStocksResponseSchema = zod_1.z.object({
    stocks: zod_1.z.array(exports.WBStockSchema),
});
// WB Update Stock Request
exports.WBUpdateStockRequestSchema = zod_1.z.object({
    stocks: zod_1.z.array(zod_1.z.object({
        sku: zod_1.z.string(),
        warehouseId: zod_1.z.number(),
        amount: zod_1.z.number(),
    })),
});
// ============================================
// Ozon API Schemas
// ============================================
// Ozon Product List
exports.OzonProductItemSchema = zod_1.z.object({
    product_id: zod_1.z.number(),
    offer_id: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    barcode: zod_1.z.string().optional(),
});
exports.OzonProductListResponseSchema = zod_1.z.object({
    result: zod_1.z.object({
        items: zod_1.z.array(exports.OzonProductItemSchema),
        total: zod_1.z.number(),
        last_id: zod_1.z.string().optional(),
    }),
});
// Ozon Product Info
exports.OzonProductInfoItemSchema = zod_1.z.object({
    id: zod_1.z.number(),
    offer_id: zod_1.z.string(),
    name: zod_1.z.string(),
    barcode: zod_1.z.string().optional(),
    primary_image: zod_1.z.string().optional(),
    images: zod_1.z.array(zod_1.z.string()).optional(),
    marketing_price: zod_1.z.string().optional(),
    min_price: zod_1.z.string().optional(),
    price: zod_1.z.string().optional(),
    stocks: zod_1.z.object({
        present: zod_1.z.number(),
        reserved: zod_1.z.number(),
    }).optional(),
});
exports.OzonProductInfoResponseSchema = zod_1.z.object({
    result: zod_1.z.object({
        items: zod_1.z.array(exports.OzonProductInfoItemSchema),
    }),
});
// Ozon Prices
exports.OzonPriceItemSchema = zod_1.z.object({
    product_id: zod_1.z.number(),
    offer_id: zod_1.z.string(),
    price: zod_1.z.object({
        price: zod_1.z.string(),
        old_price: zod_1.z.string().optional(),
        marketing_price: zod_1.z.string().optional(),
        min_price: zod_1.z.string().optional(),
    }),
});
exports.OzonPricesResponseSchema = zod_1.z.object({
    result: zod_1.z.object({
        items: zod_1.z.array(exports.OzonPriceItemSchema),
    }),
});
// Ozon Update Stock Request
exports.OzonUpdateStockRequestSchema = zod_1.z.object({
    stocks: zod_1.z.array(zod_1.z.object({
        offer_id: zod_1.z.string(),
        product_id: zod_1.z.number(),
        stock: zod_1.z.number(),
        warehouse_id: zod_1.z.number(),
    })),
});
// ============================================
// Firestore Document Schemas
// ============================================
exports.UserDocSchema = zod_1.z.object({
    telegramId: zod_1.z.number(),
    username: zod_1.z.string().nullable(),
    firstName: zod_1.z.string(),
    lastName: zod_1.z.string().nullable(),
    photoUrl: zod_1.z.string().nullable(),
    subscriptionActive: zod_1.z.boolean(),
    subscriptionExpiresAt: zod_1.z.date().nullable(),
    subscriptionPlan: zod_1.z.enum(['trial', 'basic', 'pro']).nullable(),
    protectionEnabled: zod_1.z.boolean(),
    defenseMode: exports.DefenseModeSchema,
    wbKeyRef: zod_1.z.string().nullable(),
    ozonKeyRef: zod_1.z.string().nullable(),
    totalProducts: zod_1.z.number(),
    triggeredToday: zod_1.z.number(),
    savedAmount: zod_1.z.number(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastActiveAt: zod_1.z.date(),
});
exports.ProductDocSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.number(),
    productId: zod_1.z.string(),
    nmId: zod_1.z.number().optional(),
    offerId: zod_1.z.string().optional(),
    vendorCode: zod_1.z.string(),
    barcode: zod_1.z.string().optional(),
    title: zod_1.z.string(),
    imageUrl: zod_1.z.string(),
    brand: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    currentPrice: zod_1.z.number(),
    minPrice: zod_1.z.number(),
    originalPrice: zod_1.z.number().optional(),
    stock: zod_1.z.number(),
    marketplace: exports.MarketplaceSchema,
    status: exports.ProductStatusSchema,
    isMonitored: zod_1.z.boolean(),
    lastCheckedAt: zod_1.z.date(),
    lastTriggeredAt: zod_1.z.date().nullable(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
exports.LogEntryDocSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.number(),
    type: exports.LogTypeSchema,
    productId: zod_1.z.string().optional(),
    title: zod_1.z.string(),
    message: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.unknown()),
    isRead: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
});
// ============================================
// Telegram Auth Schema
// ============================================
exports.TelegramInitDataSchema = zod_1.z.object({
    query_id: zod_1.z.string().optional(),
    user: zod_1.z.object({
        id: zod_1.z.number(),
        first_name: zod_1.z.string(),
        last_name: zod_1.z.string().optional(),
        username: zod_1.z.string().optional(),
        language_code: zod_1.z.string().optional(),
        is_premium: zod_1.z.boolean().optional(),
        photo_url: zod_1.z.string().optional(),
    }).optional(),
    auth_date: zod_1.z.number(),
    hash: zod_1.z.string(),
});
// ============================================
// Cloud Tasks Payload Schemas
// ============================================
exports.WorkerTaskPayloadSchema = zod_1.z.object({
    userId: zod_1.z.number(),
    marketplace: exports.MarketplaceSchema.optional(),
    productIds: zod_1.z.array(zod_1.z.string()).optional(), // Specific products to check
    priority: zod_1.z.enum(['normal', 'high']).default('normal'),
});
// ============================================
// API Key Input Validation
// ============================================
exports.ApiKeyInputSchema = zod_1.z.object({
    marketplace: exports.MarketplaceSchema,
    apiKey: zod_1.z.string().min(10, 'API ключ слишком короткий'),
    clientId: zod_1.z.string().optional(), // Required for Ozon
});
// ============================================
// Defense Action Result
// ============================================
exports.DefenseActionResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    action: zod_1.z.enum(['zero_stock', 'price_correction', 'none']),
    productId: zod_1.z.string(),
    marketplace: exports.MarketplaceSchema,
    oldPrice: zod_1.z.number(),
    newPrice: zod_1.z.number().optional(),
    oldStock: zod_1.z.number().optional(),
    newStock: zod_1.z.number().optional(),
    message: zod_1.z.string(),
    error: zod_1.z.string().optional(),
});
//# sourceMappingURL=index.js.map