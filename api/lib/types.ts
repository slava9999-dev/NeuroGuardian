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
  data: any;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  confirmationDetails?: any;
}

export interface AgentResponse {
  success: boolean;
  content: string;
  toolsUsed: string[];
  tokensUsed: number;
  actionRequired?: {
    type: string;
    operation: string;
    details: any;
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

export interface DBUser {
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  subscription_active: boolean;
  subscription_expires_at?: Date;
  subscription_plan?: string;
  api_key_wb?: string;
  api_key_ozon?: string;
  ozon_client_id?: string;
  defense_mode: 'zero_stock' | 'price_correction';
  protection_enabled: boolean;
  created_at: Date;
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
