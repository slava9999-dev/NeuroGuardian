export type Marketplace = 'WB' | 'Ozon';

export type PendingPriceStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Database Product type — matches `products` table
 */
export interface DBProduct {
  id: number; // SERIAL PRIMARY KEY
  user_id: number; // BIGINT NOT NULL REFERENCES users(id)
  product_id: string; // VARCHAR(255) NOT NULL
  nm_id: number | null; // BIGINT (WB nmId)
  offer_id: string | null; // VARCHAR(255) (Ozon offer_id)
  official_sku: string | null; // VARCHAR(255)
  title: string; // VARCHAR(500) NOT NULL
  image_url: string | null; // TEXT
  current_price: number; // INTEGER NOT NULL
  estimated_buyer_price: number | null; // INTEGER
  marketplace_discount_percent: number | null; // DECIMAL(5,2)
  min_price: number; // INTEGER DEFAULT 0
  current_stock: number; // INTEGER DEFAULT 0
  marketplace: Marketplace; // VARCHAR(10) NOT NULL
  account_id: number | null; // INTEGER REFERENCES marketplace_accounts(id)
  status: string; // VARCHAR(50) DEFAULT 'active'
  is_monitored: boolean; // BOOLEAN DEFAULT true
  card_discount_buffer: number | null; // INTEGER DEFAULT 0
  cost_price?: number | null; // INTEGER (Unit Economics)
  category?: string | null; // VARCHAR(255)
  // Pending price tracking
  pending_price: number | null; // INTEGER
  pending_task_id: number | null; // BIGINT
  pending_status: PendingPriceStatus | null; // VARCHAR(20)
  pending_since: Date | null; // TIMESTAMP
  created_at: Date; // TIMESTAMP
  updated_at: Date; // TIMESTAMP
}

export interface PendingPriceUpdate {
  productId: string;
  nmId?: number;
  pendingPrice: number;
  taskId: number;
  marketplace: Marketplace;
}

/**
 * Database Price Rule type — matches `price_rules` table
 */
export interface DBPriceRule {
  id: number;
  user_id: number;
  product_id: string;
  min_price: number | string;
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
