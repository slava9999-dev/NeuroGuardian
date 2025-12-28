-- Migration: 014_price_rules
-- Description: Price protection rules per product
-- Date: 2025-12-28
-- Author: NeuroGUARDIAN Production Readiness

-- ============================================
-- PRICE RULES TABLE
-- Defines pricing boundaries and automation rules per product
-- ============================================

CREATE TABLE IF NOT EXISTS price_rules (
    id SERIAL PRIMARY KEY,
    
    -- Product identification
    product_id VARCHAR(100) NOT NULL, -- Format: 'wb_123456' or 'ozon_789012'
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Price boundaries
    min_price DECIMAL(12, 2) NOT NULL, -- Minimum allowed price (floor)
    max_price DECIMAL(12, 2) NOT NULL, -- Maximum allowed price (ceiling)
    cost_price DECIMAL(12, 2), -- Cost price for margin calculations
    
    -- Target metrics
    target_margin DECIMAL(5, 2) DEFAULT 20.00, -- Target profit margin percentage
    min_margin DECIMAL(5, 2) DEFAULT 10.00, -- Minimum acceptable margin
    
    -- Competitor tracking
    competitor_tracking BOOLEAN DEFAULT false, -- Enable competitor price monitoring
    competitor_nmids TEXT, -- Comma-separated competitor nmIds/productIds
    price_match_strategy VARCHAR(20) DEFAULT 'none', -- 'none', 'match', 'undercut', 'premium'
    undercut_amount DECIMAL(5, 2) DEFAULT 1.00, -- Amount to undercut competitor (% or absolute)
    undercut_type VARCHAR(10) DEFAULT 'percent', -- 'percent' or 'absolute'
    
    -- Automation
    auto_adjust BOOLEAN DEFAULT false, -- Automatically change prices
    auto_protect BOOLEAN DEFAULT true, -- Automatically protect from promotions
    notification_enabled BOOLEAN DEFAULT true, -- Send alerts for price changes
    
    -- Thresholds
    alert_threshold_percent DECIMAL(5, 2) DEFAULT 10.00, -- Alert if price changes by more than X%
    
    -- Status
    active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT price_rules_product_unique UNIQUE(product_id),
    CONSTRAINT price_range_valid CHECK (min_price <= max_price),
    CONSTRAINT margin_valid CHECK (target_margin >= 0 AND target_margin <= 100),
    CONSTRAINT min_margin_valid CHECK (min_margin >= 0 AND min_margin <= target_margin)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_price_rules_product ON price_rules(product_id);
CREATE INDEX idx_price_rules_user ON price_rules(user_id);
CREATE INDEX idx_price_rules_active ON price_rules(active) WHERE active = true;
CREATE INDEX idx_price_rules_auto_adjust ON price_rules(auto_adjust) WHERE auto_adjust = true;
CREATE INDEX idx_price_rules_competitor ON price_rules(competitor_tracking) WHERE competitor_tracking = true;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_price_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_rules_updated
    BEFORE UPDATE ON price_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_price_rules_timestamp();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE price_rules IS 'Price protection rules defining allowed price ranges and automation settings per product';
COMMENT ON COLUMN price_rules.product_id IS 'Unified product ID in format: marketplace_externalId (e.g., wb_123456, ozon_789012)';
COMMENT ON COLUMN price_rules.min_price IS 'Floor price - agent will alert/auto-adjust if price drops below';
COMMENT ON COLUMN price_rules.max_price IS 'Ceiling price - agent will alert/auto-adjust if price exceeds';
COMMENT ON COLUMN price_rules.target_margin IS 'Target profit margin percentage for optimization';
COMMENT ON COLUMN price_rules.auto_adjust IS 'If true, agent automatically updates prices within boundaries';
COMMENT ON COLUMN price_rules.auto_protect IS 'If true, Sentinel automatically exits unwanted promotions';
COMMENT ON COLUMN price_rules.price_match_strategy IS 'How to react to competitor prices: none, match, undercut (be cheaper), premium (stay higher)';
