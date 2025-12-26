-- ============================================
-- Migration 006: Additional Performance Indexes
-- NeuroGUARDIAN Database Setup
-- ============================================

-- Index for WB products lookup by nmId (fast price updates)
CREATE INDEX IF NOT EXISTS idx_products_nm_id ON products(nm_id) WHERE nm_id IS NOT NULL;

-- Index for marketplace filtering
CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products(marketplace);

-- Composite index for user+marketplace queries (agent tool filtering)
CREATE INDEX IF NOT EXISTS idx_products_user_marketplace ON products(user_id, marketplace);

-- Index for pending price verification (cron job)
CREATE INDEX IF NOT EXISTS idx_products_pending ON products(pending_status, pending_since) 
    WHERE pending_status = 'pending';
