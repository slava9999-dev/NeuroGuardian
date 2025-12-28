-- Migration: 012_ops_events
-- Description: Operations events tracking for agent actions
-- Date: 2025-12-28
-- Author: NeuroGUARDIAN Production Readiness

-- ============================================
-- OPERATIONS EVENTS TABLE
-- Tracks all operational events from agent, sentinel, and external sources
-- ============================================

CREATE TABLE IF NOT EXISTS ops_events (
    id SERIAL PRIMARY KEY,
    
    -- Event classification
    event_type VARCHAR(50) NOT NULL,
    event_source VARCHAR(100) NOT NULL, -- 'agent', 'sentinel', 'manual', 'n8n', 'price_protection'
    
    -- Relations
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    
    -- Event data (flexible JSONB for different event types)
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- Price protection specific fields (frequently queried)
    old_price DECIMAL(12, 2),
    new_price DECIMAL(12, 2),
    competitor_price DECIMAL(12, 2),
    action_taken VARCHAR(50), -- 'price_updated', 'alert_sent', 'ignored', 'auto_protected'
    
    -- Marketplace context
    marketplace VARCHAR(20), -- 'wildberries', 'ozon'
    external_id VARCHAR(100), -- Product ID from marketplace (nmId or product_id)
    
    -- Processing status
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_result JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary query patterns
CREATE INDEX idx_ops_events_type ON ops_events(event_type);
CREATE INDEX idx_ops_events_source ON ops_events(event_source);
CREATE INDEX idx_ops_events_user ON ops_events(user_id);
CREATE INDEX idx_ops_events_product ON ops_events(product_id);
CREATE INDEX idx_ops_events_marketplace ON ops_events(marketplace);

-- Time-based queries (most recent first)
CREATE INDEX idx_ops_events_created ON ops_events(created_at DESC);

-- Composite index for dashboard queries
CREATE INDEX idx_ops_events_user_created ON ops_events(user_id, created_at DESC);

-- Partial index for unprocessed events (queue processing)
CREATE INDEX idx_ops_events_pending 
    ON ops_events(created_at) 
    WHERE processed_at IS NULL;

-- JSONB index for payload searches
CREATE INDEX idx_ops_events_payload ON ops_events USING gin(payload);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ops_events IS 'Tracks all operational events from agent, sentinel, price protection, and external sources (n8n)';
COMMENT ON COLUMN ops_events.event_type IS 'Event type: price_check, price_update, sync_products, sentinel_alert, agent_action, etc.';
COMMENT ON COLUMN ops_events.event_source IS 'Source of the event: agent, sentinel, n8n, manual, price_protection, system';
COMMENT ON COLUMN ops_events.payload IS 'Flexible JSONB payload containing event-specific data';
COMMENT ON COLUMN ops_events.action_taken IS 'For price events: what action was taken as a result';
