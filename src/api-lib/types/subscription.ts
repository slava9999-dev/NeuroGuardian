// NeuroGUARDIAN — Subscription Types
// TypeScript types for subscription system

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'business';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';

export type PaymentProvider = 'yookassa' | 'tinkoff' | 'stripe';

export interface Subscription {
  id: number;
  user_id: string | number;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  plan_id?: string;

  // Trial
  trial_started_at: Date;
  trial_ends_at: Date;

  // Billing
  current_period_start?: Date;
  current_period_end?: Date;
  next_billing_date?: Date;

  // Payment
  payment_method?: PaymentProvider;
  last_payment_at?: Date;
  last_payment_amount?: number;

  // Limits
  max_products: number;
  max_accounts: number;

  // Metadata
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
  cancellation_reason?: string;
}

export interface Payment {
  id: number;
  user_id: string | number;
  subscription_id?: number;

  payment_id: string; // External ID
  amount: number;
  currency: string;

  status: PaymentStatus;

  provider: PaymentProvider;
  provider_data?: Record<string, unknown>;

  description?: string;
  created_at: Date;
  updated_at: Date;
  paid_at?: Date;
}

export interface SubscriptionTierConfig {
  tier: SubscriptionTier;
  name_ru: string;
  name_en: string;
  price_monthly: number;
  price_yearly?: number;

  max_products: number;
  max_accounts: number;

  features: string[];

  display_order: number;
  is_popular: boolean;
  is_active: boolean;

  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionLimits {
  max_products: number;
  max_accounts: number;
  current_products: number;
  current_accounts: number;
  can_add_product: boolean;
  can_add_account: boolean;
}

export interface SubscriptionCheckResult {
  is_active: boolean;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  days_remaining?: number;
  limits: SubscriptionLimits;
  upgrade_required?: boolean;
  upgrade_reason?: string;
}

// Request/Response types for API
export interface CreatePaymentRequest {
  tier: SubscriptionTier;
  billing_period: 'monthly' | 'yearly';
  return_url?: string;
}

export interface CreatePaymentResponse {
  payment_id: string;
  payment_url: string;
  amount: number;
  currency: string;
}

export interface UpgradeSubscriptionRequest {
  new_tier: SubscriptionTier;
  billing_period: 'monthly' | 'yearly';
}

export interface CancelSubscriptionRequest {
  reason?: string;
  cancel_immediately?: boolean;
}
