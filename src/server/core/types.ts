// ============================================
// Core Type Definitions for NeuroGUARDIAN
// These should match the database schema in api/index.ts
// ============================================

/**
 * User Interface - matches the `users` table in PostgreSQL
 */
export interface User {
  // Primary key (Telegram user ID)
  id: number;

  // Profile info from Telegram
  username?: string | null;
  first_name: string;
  last_name?: string | null;
  photo_url?: string | null;

  // Status
  is_active?: boolean;

  // API Keys (encrypted with AES-256-GCM)
  api_key_wb?: string | null;
  api_key_ozon?: string | null;

  // Protection settings
  protection_enabled?: boolean;
  defense_mode?: 'zero_stock' | 'price_correction';

  // Subscription
  subscription_plan?: 'trial' | 'basic' | 'pro' | 'yearly' | null;
  subscription_end?: string | null; // ISO timestamp
  subscription_active?: boolean;

  // Payment
  payment_method_id?: string | null;

  // Stats
  total_products?: number;
  triggered_today?: number;
  saved_amount?: number;

  // Referral program
  referral_code?: string | null;
  referred_by?: string | null;

  // Reminders
  last_reminder_sent?: string | null;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

/**
 * Product Interface - matches the `products` table
 */
export interface Product {
  id?: number; // Auto-increment PK
  product_id: string; // WB nmId or Ozon product_id
  user_id: number;
  nm_id?: number; // WB specific
  marketplace: 'WB' | 'Ozon';
  title: string;
  image_url?: string | null;
  current_price: number;
  min_price: number; // Stop-loss limit
  current_stock: number;
  status: 'active' | 'protected' | 'archived';
  is_monitored?: boolean;
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sentinel Log Interface - matches the `sentinel_logs` table
 */
export interface SentinelLog {
  id: number;
  user_id: number;
  product_id: string;
  product_title?: string | null;
  detected_price: number;
  min_price: number;
  defense_action: 'zero_stock' | 'correct_price';
  saved_amount: number;
  marketplace: 'WB' | 'Ozon';
  created_at: string;
}

/**
 * Transaction Interface - matches the `transactions` table
 */
export interface Transaction {
  id: string;
  user_id: number;
  yookassa_payment_id?: string | null;
  amount: number;
  status: 'pending' | 'succeeded' | 'canceled' | 'waiting_for_capture';
  plan: 'trial' | 'basic' | 'pro' | 'yearly';
  created_at: string;
  paid_at?: string | null;
}

/**
 * Agent Result - response from AI agent
 */
export interface AgentResult {
  success: boolean;
  content: string;
  actionRequired?: {
    type: 'confirmation';
    operation: string;
    details: Record<string, unknown>;
    confirmationMessage: string;
  };
  metadata?: {
    executionTime: number;
    model: string;
    toolsUsed: string[];
    tokensUsed: number;
    complexity?: 'simple' | 'complex';
  };
  error?: string;
}

/**
 * Common Service Response
 */
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Telegram User from initData
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

/**
 * Subscription Plans
 */
export type SubscriptionPlan = 'trial' | 'basic' | 'pro' | 'yearly';

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  discountedPrice: number;
  durationDays: number;
  maxProducts: number;
  features: string[];
}

/**
 * Defense Modes
 */
export type DefenseMode = 'zero_stock' | 'price_correction';
