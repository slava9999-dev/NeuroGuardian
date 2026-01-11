export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface UserContext {
  wbApiKey?: string;
  ozonApiKey?: string;
  ozonClientId?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  discountedPrice: number;
  durationDays: number;
  maxProducts: number;
  features: string[];
}

export type PlanId = 'basic' | 'pro' | 'yearly';

/**
 * Database User type — matches `users` table exactly
 */
export interface DBUser {
  id: number; // BIGINT PRIMARY KEY (Telegram user ID)
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  is_active: boolean;
  api_key_wb: string | null;
  api_key_ozon: string | null;
  ozon_client_id: string | null;
  protection_enabled: boolean;
  defense_mode: 'zero_stock' | 'price_correction';
  subscription_plan: 'trial' | 'basic' | 'pro' | 'yearly' | null;
  subscription_end: Date | null;
  subscription_active: boolean;
  payment_method_id: string | null;
  total_products: number;
  triggered_today: number;
  saved_amount: number;
  referral_code: string | null;
  referred_by: string | null;
  last_reminder_sent: Date | null;
  price_buffer_percent: number;
  warning_threshold_percent: number;
  created_at: Date;
  notifications_mode: 'all' | 'threats_only';
  updated_at: Date;
}
