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
  price_buffer_percent: number; // INTEGER DEFAULT 5 — buffer for card discounts (Ozon Card, WB Pay)
  warning_threshold_percent: number; // INTEGER DEFAULT 10 — alert when price is within this % of min
  created_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  notifications_mode: 'all' | 'threats_only'; // VARCHAR(20) DEFAULT 'all' — controls Sentinel report frequency
  updated_at: Date; // TIMESTAMP DEFAULT CURRENT_TIMESTAMP
}

export interface Product {
  id: number;
  user_id: string; // Changed to string
  sku: string;
  name: string;
  current_price: number;
  min_price?: number;
  wb_nmid?: string; // Changed to string
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

export interface ProductMediaAsset {
  id: number;
  productId: string;
  userId: string;
  type: string;
  status: string;
  originalUrl: string;
  processedUrl?: string | null;
  thumbnailUrl?: string | null;
  visionMetadata?: Record<string, unknown> | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  createdAt: string;
}

/**
 * Database Product type — matches `products` table exactly
 * Includes pending price tracking fields (Dec 2024 Audit)
 */
export interface DBProduct {
  media_assets?: ProductMediaAsset[];
  id: number; // SERIAL PRIMARY KEY
  user_id: string; // VARCHAR(50) NOT NULL REFERENCES users(id)
  product_id: string; // VARCHAR(255) NOT NULL
  nm_id: string | null; // VARCHAR(50) (WB nmId)
  offer_id: string | null; // VARCHAR(255) (Ozon offer_id - migration 007)
  official_sku: string | null; // VARCHAR(255)
  title: string; // VARCHAR(500) NOT NULL
  image_url: string | null; // TEXT
  current_price: number; // INTEGER NOT NULL
  estimated_buyer_price: number | null; // INTEGER — estimated price buyer sees (Jan 2026)
  marketplace_discount_percent: number | null; // DECIMAL(5,2) — total marketplace discount % (Jan 2026)
  min_price: number; // INTEGER DEFAULT 0
  current_stock: number; // INTEGER DEFAULT 0
  marketplace: 'WB' | 'Ozon'; // VARCHAR(10) NOT NULL
  account_id: number | null; // INTEGER REFERENCES marketplace_accounts(id)
  status: string; // VARCHAR(50) DEFAULT 'active'
  is_monitored: boolean; // BOOLEAN DEFAULT true
  // Price protection buffer (overrides user setting if > 0)
  card_discount_buffer: number | null; // INTEGER DEFAULT 0 — per-product card discount buffer
  cost_price?: number | null; // INTEGER (Unit Economics)
  min_margin?: number | null; // INTEGER (Target Profit Margin in RUB)
  barcode?: string | null; // VARCHAR(255)
  category?: string | null; // VARCHAR(255)
  width_cm?: number | null;
  height_cm?: number | null;
  depth_cm?: number | null;
  weight_kg?: number | null; // Float

  // Hunter fields (Jan 2026)
  competitor_url?: string | null;
  competitor_price?: number | null; // INTEGER DEFAULT 0
  price_strategy?: string | null; // 'passive' | 'aggressive:10'

  // SPP Buffer fields for smart stop-loss (Jan 2026)
  target_buyer_price?: number | null; // INTEGER — desired minimum price for buyer
  spp_buffer_percent?: number | null; // INTEGER DEFAULT 25 — expected platform discount %
  auto_adjust_min_price?: boolean | null; // BOOLEAN DEFAULT false — auto-correct min_price
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

/**
 * Database Price Rule type — matches `price_rules` table
 */
export interface DBPriceRule {
  id: number;
  user_id: number;
  product_id: string;
  min_price: number | string; // Postgres numeric often comes as string
  max_price: number | string;
  target_margin: number | string;
  competitor_tracking: boolean;
  competitor_nmids: string | null;
  price_match_strategy: 'none' | 'match' | 'undercut' | 'premium';
  undercut_amount: number | string;
  undercut_type: 'percent' | 'absolute';
  auto_adjust: boolean;
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * N8n Workflow type
 */
/**
 * Sentinel Log entry — matches `sentinel_logs` table
 */
export interface SentinelLog {
  id: number;
  user_id: string;
  product_id: string;
  product_title: string;
  detected_price: number;
  min_price: number;
  defense_action: 'notify' | 'restore' | 'block' | 'discount';
  saved_amount: number;
  marketplace: string;
  created_at: Date;
  threat_type?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: unknown[];
  connections: unknown;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
