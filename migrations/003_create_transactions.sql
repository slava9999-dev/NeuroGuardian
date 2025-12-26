-- ============================================
-- Migration 003: Transactions Table
-- NeuroGUARDIAN Database Setup
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    yookassa_payment_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,                        -- 'pending', 'succeeded', 'failed'
    plan VARCHAR(50) NOT NULL,                          -- 'basic', 'pro', 'yearly'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- Index for user transactions lookup
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
