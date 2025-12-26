// ============================================
// NeuroGUARDIAN — Type Definitions
// Shared TypeScript interfaces
// ============================================

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface InitDataValidationResult {
  valid: boolean;
  user: TelegramUser | null;
  error?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AgentToolResult {
  data: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  confirmationDetails?: Record<string, unknown>;
}

export interface AgentResponse {
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: {
    type: string;
    operation: string;
    details: Record<string, unknown>;
    confirmationMessage: string;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
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

export interface UserContext {
  wbApiKey?: string;
  ozonApiKey?: string;
  ozonClientId?: string;
}

/**
 * Database User type — matches `users` table exactly
 * Primary key is `id` (Telegram user ID stored as BIGINT)
 */
export interface DBUser {
  id: number; // BIGINT PRIMARY KEY (Telegram user ID)
  username: string | null; // VARCHAR(255)
  first_name: string; // VARCHAR(255) NOT NULL
  last_name: string | null; // VARCHAR(255)
  photo_url: string | null; // TEXT
  is_active: boolean; // BOOLEAN DEFAULT true
  api_key_wb: string | null; // TEXT
  api_key_ozon: string | null; // TEXT
  ozon_client_id: string | null; // VARCHAR(255)
  protection_enabled: boolean; // BOOLEAN DEFAULT false
  defense_mode: 'zero_stock' | 'price_correction'; // VARCHAR(50) DEFAULT 'zero_stock'
  subscription_plan: 'trial' | 'basic' | 'pro' | 'yearly' | null; // VARCHAR(50) DEFAULT 'trial'
  subscription_end: Date | null; // TIMESTAMP
  subscription_active: boolean; // BOOLEAN DEFAULT false
  payment_method_id: string | null; // VARCHAR(255)
  total_products: number; // INTEGER DEFAULT 0
  triggered_today: number; // INTEGER DEFAULT 0
  saved_amount: number; // DECIMAL(12, 2) DEFAULT 0
  referral_code: string | null; // VARCHAR(50) UNIQUE
  referred_by: string | null; // VARCHAR(50)
  last_reminder_sent: Date | null; // TIMESTAMP
  created_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}

export interface Product {
  id: number;
  user_id: number;
  sku: string;
  name: string;
  current_price: number;
  min_price?: number;
  wb_nmid?: number;
  ozon_product_id?: string;
  marketplace: 'WB' | 'Ozon';
  stock: number;
  protected: boolean;
  created_at: Date;
}

// ============================================
// PENDING PRICE TRACKING TYPES
// For WB async task status verification
// ============================================

export type PendingPriceStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Database Product type — matches `products` table exactly
 * Includes pending price tracking fields (Dec 2024 Audit)
 */
export interface DBProduct {
  id: number; // SERIAL PRIMARY KEY
  user_id: number; // BIGINT NOT NULL REFERENCES users(id)
  product_id: string; // VARCHAR(255) NOT NULL
  nm_id: number | null; // BIGINT (WB nmId)
  offer_id: string | null; // VARCHAR(255) (Ozon offer_id - migration 007)
  title: string; // VARCHAR(500) NOT NULL
  image_url: string | null; // TEXT
  current_price: number; // INTEGER NOT NULL
  min_price: number; // INTEGER DEFAULT 0
  current_stock: number; // INTEGER DEFAULT 0
  marketplace: 'WB' | 'Ozon'; // VARCHAR(10) NOT NULL
  status: string; // VARCHAR(50) DEFAULT 'active'
  is_monitored: boolean; // BOOLEAN DEFAULT true
  // Pending price tracking fields (Dec 2024 Audit)
  pending_price: number | null; // INTEGER
  pending_task_id: number | null; // BIGINT
  pending_status: PendingPriceStatus | null; // VARCHAR(20)
  pending_since: Date | null; // TIMESTAMP
  created_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  updated_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}

export interface PendingPriceUpdate {
  productId: string;
  nmId?: number;
  pendingPrice: number;
  taskId: number;
  marketplace: 'WB' | 'Ozon';
}
