-- ============================================
-- Migration 004: Sentinel Logs Table
-- NeuroGUARDIAN Database Setup
-- ============================================

CREATE TABLE IF NOT EXISTS sentinel_logs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    product_title VARCHAR(500),
    detected_price INTEGER NOT NULL,
    min_price INTEGER NOT NULL,
    defense_action VARCHAR(50) NOT NULL,                -- 'zero_stock', 'price_correction'
    saved_amount INTEGER DEFAULT 0,
    marketplace VARCHAR(10) NOT NULL,                   -- 'WB' or 'Ozon'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Composite index for user logs with time ordering
CREATE INDEX IF NOT EXISTS idx_sentinel_logs_user ON sentinel_logs(user_id, created_at DESC);
