-- ============================================
-- Migration 010: Marketplace Orders Table
-- NeuroGUARDIAN - Permanent Sales History
-- ============================================

-- Create table for storing individual orders/sales from marketplaces
-- This enables accurate historical analytics (ABC, Unit Economics)
-- without relying on immediate API calls or estimates.

CREATE TABLE IF NOT EXISTS marketplace_orders (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Product identification
    product_id VARCHAR(255),                        -- Link to our products table (optional, as product might be deleted)
    marketplace_product_id VARCHAR(255) NOT NULL,   -- WB nmId or Ozon product_id
    sku VARCHAR(255),                               -- Vendor code / Article
    title VARCHAR(500),                             -- Snapshot of product title at time of sale
    marketplace VARCHAR(10) NOT NULL,               -- 'WB' or 'Ozon'
    
    -- Order details
    order_id VARCHAR(255) NOT NULL,                 -- Marketplace's unique order ID (srid for WB, posting_number for Ozon)
    order_date TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,                    -- pending, delivered, canceled, returned
    
    -- Financials (in RUB)
    price_total DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Total price paid by customer
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Costs (snapshot at time of order)
    commission DECIMAL(10, 2) DEFAULT 0,
    logistics DECIMAL(10, 2) DEFAULT 0,
    cost_price DECIMAL(10, 2) DEFAULT 0,            -- Snapshot of COGS
    
    -- Metadata
    region VARCHAR(100),                            -- Delivery region
    warehouse VARCHAR(100),                         -- Dispatch warehouse
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure uniqueness to prevent duplicates during sync
    UNIQUE(user_id, marketplace, order_id)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON marketplace_orders(user_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_product ON marketplace_orders(marketplace_product_id);
CREATE INDEX IF NOT EXISTS idx_orders_analytics ON marketplace_orders(user_id, marketplace, status, order_date);
