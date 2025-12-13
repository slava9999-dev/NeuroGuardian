// ============================================
// NeuroGUARDIAN — Firestore Data Models
// Professional data architecture
// ============================================

import { z } from 'zod';

// ============================================
// SUBSCRIPTION PLANS & LIMITS
// ============================================

export const SubscriptionPlan = z.enum(['trial', 'basic', 'pro', 'enterprise']);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlan>;

export const PLAN_LIMITS = {
  trial: {
    maxProducts: 10,
    checkIntervalMinutes: 15,
    defenseModes: ['zero_stock'] as const,
    alertChannels: ['telegram'] as const,
    supportPriority: 'low',
    durationDays: 7,
    price: 0,
  },
  basic: {
    maxProducts: 100,
    checkIntervalMinutes: 5,
    defenseModes: ['zero_stock'] as const,
    alertChannels: ['telegram'] as const,
    supportPriority: 'normal',
    durationDays: 30,
    price: 990,
  },
  pro: {
    maxProducts: 1000,
    checkIntervalMinutes: 2,
    defenseModes: ['zero_stock', 'price_correction'] as const,
    alertChannels: ['telegram', 'email'] as const,
    supportPriority: 'high',
    durationDays: 30,
    price: 1990,
  },
  enterprise: {
    maxProducts: -1, // unlimited
    checkIntervalMinutes: 1,
    defenseModes: ['zero_stock', 'price_correction'] as const,
    alertChannels: ['telegram', 'email', 'webhook'] as const,
    supportPriority: 'critical',
    durationDays: 365,
    price: 19990,
  },
} as const;

// ============================================
// USER SCHEMA
// ============================================

export const UserSchema = z.object({
  // Identity
  telegramId: z.number(),
  username: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  languageCode: z.string().default('ru'),
  
  // Subscription
  subscriptionPlan: SubscriptionPlan.default('trial'),
  subscriptionActive: z.boolean().default(false),
  subscriptionStartedAt: z.date().nullable(),
  subscriptionExpiresAt: z.date().nullable(),
  autoRenew: z.boolean().default(true),
  
  // Billing
  customerId: z.string().nullable(), // YooKassa customer ID
  paymentMethodId: z.string().nullable(), // Saved card for auto-renewal
  totalPaid: z.number().default(0),
  
  // Protection settings
  protectionEnabled: z.boolean().default(false),
  defenseMode: z.enum(['zero_stock', 'price_correction']).default('zero_stock'),
  alertsEnabled: z.boolean().default(true),
  emailForAlerts: z.string().email().nullable(),
  
  // API Keys (references to Secret Manager)
  wbKeyRef: z.string().nullable(), // Secret Manager path
  ozonKeyRef: z.string().nullable(),
  ozonClientId: z.string().nullable(),
  
  // Statistics
  totalProducts: z.number().default(0),
  protectedProducts: z.number().default(0),
  triggeredToday: z.number().default(0),
  triggeredAllTime: z.number().default(0),
  savedAmount: z.number().default(0), // Total money saved by protection
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
  lastActiveAt: z.date(),
  lastCheckedAt: z.date().nullable(),
  
  // Feature flags
  betaFeatures: z.boolean().default(false),
  referralCode: z.string().nullable(),
  referredBy: z.number().nullable(), // telegramId of referrer
});

export type User = z.infer<typeof UserSchema>;

// ============================================
// PRODUCT SCHEMA
// ============================================

export const ProductSchema = z.object({
  productId: z.string(), // "wb-123456" or "ozon-789"
  userId: z.number(),
  
  // Marketplace
  marketplace: z.enum(['WB', 'Ozon']),
  nmId: z.number().nullable(), // WB nmId
  offerId: z.string().nullable(), // Ozon offer_id
  
  // Product info
  title: z.string(),
  vendorCode: z.string(),
  imageUrl: z.string().nullable(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  
  // Pricing
  currentPrice: z.number(),
  minPrice: z.number().default(0), // Stop-loss level
  originalPrice: z.number().nullable(), // Before any promotion
  
  // Stock
  stock: z.number().default(0),
  warehouseId: z.number().nullable(),
  
  // Status
  status: z.enum(['active', 'protected', 'triggered', 'paused', 'error']).default('active'),
  lastTriggeredAt: z.date().nullable(),
  lastCheckedAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  
  // Statistics
  triggerCount: z.number().default(0),
  savedAmount: z.number().default(0),
  
  // Metadata
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Product = z.infer<typeof ProductSchema>;

// ============================================
// TRANSACTION SCHEMA (Payments)
// ============================================

export const TransactionSchema = z.object({
  id: z.string(), // UUID
  userId: z.number(),
  
  // Payment details
  type: z.enum(['subscription', 'refund', 'bonus']),
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded', 'canceled']),
  
  // Amount
  amount: z.number(),
  currency: z.string().default('RUB'),
  
  // Plan info
  planId: SubscriptionPlan.nullable(),
  periodDays: z.number().nullable(),
  
  // Payment provider
  provider: z.enum(['yookassa', 'cloudpayments', 'telegram', 'manual']),
  externalId: z.string().nullable(), // Provider's transaction ID
  paymentMethodType: z.string().nullable(), // "bank_card", "sbp", etc.
  
  // Metadata
  description: z.string().nullable(),
  metadata: z.record(z.any()).default({}),
  
  // Timestamps
  createdAt: z.date(),
  paidAt: z.date().nullable(),
  refundedAt: z.date().nullable(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// ============================================
// LOG ENTRY SCHEMA
// ============================================

export const LogEntrySchema = z.object({
  id: z.string(),
  userId: z.number(),
  
  type: z.enum([
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
  
  title: z.string(),
  message: z.string(),
  
  // Related entities
  productId: z.string().nullable(),
  transactionId: z.string().nullable(),
  
  // Data
  metadata: z.record(z.any()).default({}),
  
  // Read status
  read: z.boolean().default(false),
  
  // Timestamp
  createdAt: z.date(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

// ============================================
// REFERRAL SCHEMA
// ============================================

export const ReferralSchema = z.object({
  code: z.string(), // Unique referral code
  ownerId: z.number(), // telegramId of code owner
  
  // Stats
  totalReferrals: z.number().default(0),
  activeReferrals: z.number().default(0),
  totalEarned: z.number().default(0),
  
  // Settings
  commissionPercent: z.number().default(20), // 20% of referred user's payment
  
  // Timestamps
  createdAt: z.date(),
});

export type Referral = z.infer<typeof ReferralSchema>;

// ============================================
// PROMO CODE SCHEMA
// ============================================

export const PromoCodeSchema = z.object({
  code: z.string().toUpperCase(),
  
  // Discount
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number(), // Percent (0-100) or fixed amount
  
  // Limits
  maxUses: z.number().nullable(), // null = unlimited
  usedCount: z.number().default(0),
  
  // Validity
  validFrom: z.date(),
  validUntil: z.date().nullable(),
  
  // Restrictions
  planRestrictions: z.array(SubscriptionPlan).nullable(), // null = all plans
  newUsersOnly: z.boolean().default(false),
  
  // Metadata
  createdBy: z.string(), // Admin ID
  createdAt: z.date(),
});

export type PromoCode = z.infer<typeof PromoCodeSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

export function checkPlanLimits(user: User): {
  canAddProducts: boolean;
  canUseDefenseMode: (mode: string) => boolean;
  remainingProducts: number;
  checkInterval: number;
} {
  const limits = PLAN_LIMITS[user.subscriptionPlan];
  const maxProducts = limits.maxProducts === -1 ? Infinity : limits.maxProducts;
  
  return {
    canAddProducts: user.totalProducts < maxProducts,
    canUseDefenseMode: (mode: string) => 
      (limits.defenseModes as readonly string[]).includes(mode),
    remainingProducts: maxProducts - user.totalProducts,
    checkInterval: limits.checkIntervalMinutes,
  };
}

export function isSubscriptionActive(user: User): boolean {
  if (!user.subscriptionActive) return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt) > new Date();
}

export function getDaysUntilExpiry(user: User): number | null {
  if (!user.subscriptionExpiresAt) return null;
  const diff = new Date(user.subscriptionExpiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
