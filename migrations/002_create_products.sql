-- ============================================
-- Migration 002: Products Table
-- NeuroGUARDIAN Database Setup
-- ============================================

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    nm_id BIGINT,                                       -- WB nmId
    title VARCHAR(500) NOT NULL,
    image_url TEXT,
    current_price INTEGER NOT NULL,
    min_price INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    marketplace VARCHAR(10) NOT NULL,                   -- 'WB' or 'Ozon'
    status VARCHAR(50) DEFAULT 'active',
    is_monitored BOOLEAN DEFAULT true,
    -- Pending price tracking (Dec 2024 Audit)
    pending_price INTEGER,
    pending_task_id BIGINT,
    pending_status VARCHAR(20),
    pending_since TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_monitoring ON products(user_id, min_price) WHERE min_price > 0;
