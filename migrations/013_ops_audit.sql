-- Migration: 013_ops_audit
-- Description: Immutable audit trail for all system changes
-- Date: 2025-12-28
-- Author: NeuroGUARDIAN Production Readiness

-- ============================================
-- OPERATIONS AUDIT TABLE
-- Immutable audit trail for compliance and debugging
-- ============================================

CREATE TABLE IF NOT EXISTS ops_audit (
    id SERIAL PRIMARY KEY,
    
    -- Who performed the action
    actor_type VARCHAR(20) NOT NULL, -- 'user', 'agent', 'system', 'n8n', 'sentinel'
    actor_id VARCHAR(100), -- user_id, system identifier, or n8n workflow id
    
    -- What was done
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'execute', 'login', 'price_change'
    resource_type VARCHAR(50) NOT NULL, -- 'product', 'price', 'settings', 'user', 'api_key', 'subscription'
    resource_id VARCHAR(100), -- ID of the affected resource
    
    -- Change details
    old_value JSONB, -- Previous state (null for creates)
    new_value JSONB, -- New state (null for deletes)
    metadata JSONB DEFAULT '{}', -- Additional context (e.g., reason, trigger)
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100), -- Correlation ID for request tracing
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    
    -- Timestamp (immutable - no updated_at)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Actor queries
CREATE INDEX idx_ops_audit_actor ON ops_audit(actor_type, actor_id);

-- Action queries
CREATE INDEX idx_ops_audit_action ON ops_audit(action);

-- Resource queries
CREATE INDEX idx_ops_audit_resource ON ops_audit(resource_type, resource_id);

-- Time-based queries
CREATE INDEX idx_ops_audit_created ON ops_audit(created_at DESC);

-- Failed operations (for monitoring)
CREATE INDEX idx_ops_audit_failures ON ops_audit(created_at DESC) WHERE NOT success;

-- Request tracing
CREATE INDEX idx_ops_audit_request_id ON ops_audit(request_id) WHERE request_id IS NOT NULL;

-- ============================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================

-- Function to prevent modifications to audit records
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be modified or deleted. Contact system administrator if data correction is required.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates
CREATE TRIGGER audit_no_update
    BEFORE UPDATE ON ops_audit
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Trigger to prevent deletes
CREATE TRIGGER audit_no_delete
    BEFORE DELETE ON ops_audit
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ops_audit IS 'Immutable audit trail for all system changes. Records cannot be modified or deleted.';
COMMENT ON COLUMN ops_audit.actor_type IS 'Type of actor: user (human), agent (AI), system (automated), n8n (workflow), sentinel (monitoring)';
COMMENT ON COLUMN ops_audit.action IS 'Action performed: create, update, delete, execute, login, price_change, api_call, etc.';
COMMENT ON COLUMN ops_audit.resource_type IS 'Type of resource affected: product, price, settings, user, api_key, subscription, etc.';
COMMENT ON COLUMN ops_audit.request_id IS 'Correlation ID for distributed tracing across services';

-- ============================================
-- RETENTION POLICY NOTE
-- ============================================
-- Audit records should be retained for a minimum of 90 days.
-- For GDPR compliance, consider archiving to cold storage after 1 year.
-- Implement external job for archive/purge if needed.
