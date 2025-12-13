"use strict";
// ============================================
// NeuroGUARDIAN — Firestore Data Models
// Professional data architecture
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoCodeSchema = exports.ReferralSchema = exports.LogEntrySchema = exports.TransactionSchema = exports.ProductSchema = exports.UserSchema = exports.PLAN_LIMITS = exports.SubscriptionPlan = void 0;
exports.checkPlanLimits = checkPlanLimits;
exports.isSubscriptionActive = isSubscriptionActive;
exports.getDaysUntilExpiry = getDaysUntilExpiry;
const zod_1 = require("zod");
// ============================================
// SUBSCRIPTION PLANS & LIMITS
// ============================================
exports.SubscriptionPlan = zod_1.z.enum(['trial', 'basic', 'pro', 'enterprise']);
exports.PLAN_LIMITS = {
    trial: {
        maxProducts: 10,
        checkIntervalMinutes: 15,
        defenseModes: ['zero_stock'],
        alertChannels: ['telegram'],
        supportPriority: 'low',
        durationDays: 7,
        price: 0,
    },
    basic: {
        maxProducts: 100,
        checkIntervalMinutes: 5,
        defenseModes: ['zero_stock'],
        alertChannels: ['telegram'],
        supportPriority: 'normal',
        durationDays: 30,
        price: 990,
    },
    pro: {
        maxProducts: 1000,
        checkIntervalMinutes: 2,
        defenseModes: ['zero_stock', 'price_correction'],
        alertChannels: ['telegram', 'email'],
        supportPriority: 'high',
        durationDays: 30,
        price: 1990,
    },
    enterprise: {
        maxProducts: -1, // unlimited
        checkIntervalMinutes: 1,
        defenseModes: ['zero_stock', 'price_correction'],
        alertChannels: ['telegram', 'email', 'webhook'],
        supportPriority: 'critical',
        durationDays: 365,
        price: 19990,
    },
};
// ============================================
// USER SCHEMA
// ============================================
exports.UserSchema = zod_1.z.object({
    // Identity
    telegramId: zod_1.z.number(),
    username: zod_1.z.string().nullable(),
    firstName: zod_1.z.string(),
    lastName: zod_1.z.string().nullable(),
    photoUrl: zod_1.z.string().nullable(),
    languageCode: zod_1.z.string().default('ru'),
    // Subscription
    subscriptionPlan: exports.SubscriptionPlan.default('trial'),
    subscriptionActive: zod_1.z.boolean().default(false),
    subscriptionStartedAt: zod_1.z.date().nullable(),
    subscriptionExpiresAt: zod_1.z.date().nullable(),
    autoRenew: zod_1.z.boolean().default(true),
    // Billing
    customerId: zod_1.z.string().nullable(), // YooKassa customer ID
    paymentMethodId: zod_1.z.string().nullable(), // Saved card for auto-renewal
    totalPaid: zod_1.z.number().default(0),
    // Protection settings
    protectionEnabled: zod_1.z.boolean().default(false),
    defenseMode: zod_1.z.enum(['zero_stock', 'price_correction']).default('zero_stock'),
    alertsEnabled: zod_1.z.boolean().default(true),
    emailForAlerts: zod_1.z.string().email().nullable(),
    // API Keys (references to Secret Manager)
    wbKeyRef: zod_1.z.string().nullable(), // Secret Manager path
    ozonKeyRef: zod_1.z.string().nullable(),
    ozonClientId: zod_1.z.string().nullable(),
    // Statistics
    totalProducts: zod_1.z.number().default(0),
    protectedProducts: zod_1.z.number().default(0),
    triggeredToday: zod_1.z.number().default(0),
    triggeredAllTime: zod_1.z.number().default(0),
    savedAmount: zod_1.z.number().default(0), // Total money saved by protection
    // Metadata
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastActiveAt: zod_1.z.date(),
    lastCheckedAt: zod_1.z.date().nullable(),
    // Feature flags
    betaFeatures: zod_1.z.boolean().default(false),
    referralCode: zod_1.z.string().nullable(),
    referredBy: zod_1.z.number().nullable(), // telegramId of referrer
});
// ============================================
// PRODUCT SCHEMA
// ============================================
exports.ProductSchema = zod_1.z.object({
    productId: zod_1.z.string(), // "wb-123456" or "ozon-789"
    userId: zod_1.z.number(),
    // Marketplace
    marketplace: zod_1.z.enum(['WB', 'Ozon']),
    nmId: zod_1.z.number().nullable(), // WB nmId
    offerId: zod_1.z.string().nullable(), // Ozon offer_id
    // Product info
    title: zod_1.z.string(),
    vendorCode: zod_1.z.string(),
    imageUrl: zod_1.z.string().nullable(),
    category: zod_1.z.string().nullable(),
    brand: zod_1.z.string().nullable(),
    // Pricing
    currentPrice: zod_1.z.number(),
    minPrice: zod_1.z.number().default(0), // Stop-loss level
    originalPrice: zod_1.z.number().nullable(), // Before any promotion
    // Stock
    stock: zod_1.z.number().default(0),
    warehouseId: zod_1.z.number().nullable(),
    // Status
    status: zod_1.z.enum(['active', 'protected', 'triggered', 'paused', 'error']).default('active'),
    lastTriggeredAt: zod_1.z.date().nullable(),
    lastCheckedAt: zod_1.z.date().nullable(),
    errorMessage: zod_1.z.string().nullable(),
    // Statistics
    triggerCount: zod_1.z.number().default(0),
    savedAmount: zod_1.z.number().default(0),
    // Metadata
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
// ============================================
// TRANSACTION SCHEMA (Payments)
// ============================================
exports.TransactionSchema = zod_1.z.object({
    id: zod_1.z.string(), // UUID
    userId: zod_1.z.number(),
    // Payment details
    type: zod_1.z.enum(['subscription', 'refund', 'bonus']),
    status: zod_1.z.enum(['pending', 'succeeded', 'failed', 'refunded', 'canceled']),
    // Amount
    amount: zod_1.z.number(),
    currency: zod_1.z.string().default('RUB'),
    // Plan info
    planId: exports.SubscriptionPlan.nullable(),
    periodDays: zod_1.z.number().nullable(),
    // Payment provider
    provider: zod_1.z.enum(['yookassa', 'cloudpayments', 'telegram', 'manual']),
    externalId: zod_1.z.string().nullable(), // Provider's transaction ID
    paymentMethodType: zod_1.z.string().nullable(), // "bank_card", "sbp", etc.
    // Metadata
    description: zod_1.z.string().nullable(),
    metadata: zod_1.z.record(zod_1.z.any()).default({}),
    // Timestamps
    createdAt: zod_1.z.date(),
    paidAt: zod_1.z.date().nullable(),
    refundedAt: zod_1.z.date().nullable(),
});
// ============================================
// LOG ENTRY SCHEMA
// ============================================
exports.LogEntrySchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.number(),
    type: zod_1.z.enum([
        'defense_triggered',
        'price_restored',
        'stock_zeroed',
        'api_connected',
        'api_error',
        'sync_completed',
        'subscription_activated',
        'subscription_expired',
        'payment_received',
        'payment_failed',
        'settings_changed',
        'error',
        'info',
    ]),
    title: zod_1.z.string(),
    message: zod_1.z.string(),
    // Related entities
    productId: zod_1.z.string().nullable(),
    transactionId: zod_1.z.string().nullable(),
    // Data
    metadata: zod_1.z.record(zod_1.z.any()).default({}),
    // Read status
    read: zod_1.z.boolean().default(false),
    // Timestamp
    createdAt: zod_1.z.date(),
});
// ============================================
// REFERRAL SCHEMA
// ============================================
exports.ReferralSchema = zod_1.z.object({
    code: zod_1.z.string(), // Unique referral code
    ownerId: zod_1.z.number(), // telegramId of code owner
    // Stats
    totalReferrals: zod_1.z.number().default(0),
    activeReferrals: zod_1.z.number().default(0),
    totalEarned: zod_1.z.number().default(0),
    // Settings
    commissionPercent: zod_1.z.number().default(20), // 20% of referred user's payment
    // Timestamps
    createdAt: zod_1.z.date(),
});
// ============================================
// PROMO CODE SCHEMA
// ============================================
exports.PromoCodeSchema = zod_1.z.object({
    code: zod_1.z.string().toUpperCase(),
    // Discount
    discountType: zod_1.z.enum(['percent', 'fixed']),
    discountValue: zod_1.z.number(), // Percent (0-100) or fixed amount
    // Limits
    maxUses: zod_1.z.number().nullable(), // null = unlimited
    usedCount: zod_1.z.number().default(0),
    // Validity
    validFrom: zod_1.z.date(),
    validUntil: zod_1.z.date().nullable(),
    // Restrictions
    planRestrictions: zod_1.z.array(exports.SubscriptionPlan).nullable(), // null = all plans
    newUsersOnly: zod_1.z.boolean().default(false),
    // Metadata
    createdBy: zod_1.z.string(), // Admin ID
    createdAt: zod_1.z.date(),
});
// ============================================
// HELPER FUNCTIONS
// ============================================
function checkPlanLimits(user) {
    const limits = exports.PLAN_LIMITS[user.subscriptionPlan];
    const maxProducts = limits.maxProducts === -1 ? Infinity : limits.maxProducts;
    return {
        canAddProducts: user.totalProducts < maxProducts,
        canUseDefenseMode: (mode) => limits.defenseModes.includes(mode),
        remainingProducts: maxProducts - user.totalProducts,
        checkInterval: limits.checkIntervalMinutes,
    };
}
function isSubscriptionActive(user) {
    if (!user.subscriptionActive)
        return false;
    if (!user.subscriptionExpiresAt)
        return false;
    return new Date(user.subscriptionExpiresAt) > new Date();
}
function getDaysUntilExpiry(user) {
    if (!user.subscriptionExpiresAt)
        return null;
    const diff = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
//# sourceMappingURL=models.js.map