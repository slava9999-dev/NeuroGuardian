// User Interface
export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  created_at?: string;
  api_key_wb?: string;
  api_key_ozon?: string;
  subscription_status: 'active' | 'inactive' | 'trial';
  subscription_end_date?: string;
  trial_used?: boolean;
  admin_notes?: string;
  referral_code?: string;
  referred_by?: string;
  saved_amount?: number;
  triggered_today?: number;
}

// Product Interface
export interface Product {
  product_id: string; // nmId or similar
  user_id: number;
  marketplace: 'WB' | 'Ozon';
  title: string;
  current_price: number;
  min_price: number; // Stop-loss limit
  current_stock: number;
  status: 'active' | 'protected' | 'archived';
  last_updated: string;
  metadata?: Record<string, unknown>;
}

// Sentinel Log Interface
export interface SentinelLog {
  id: string;
  user_id: number;
  product_id: string;
  product_title?: string;
  detected_price: number;
  min_price: number;
  defense_action: 'zero_stock' | 'correct_price';
  saved_amount: number;
  marketplace: 'WB' | 'Ozon';
  created_at: string;
}

export interface AgentResult {
  success: boolean;
  content: string;
  actionRequired?: unknown;
  metadata?: {
    executionTime: number;
    model: string;
    toolsUsed: string[];
    tokensUsed: number;
  };
}

// Common Service Response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
