-- Migration: Create Ops Panel tables
-- Date: 2025-01-01

-- 1. Table for System Events (Event Bus)
CREATE TABLE IF NOT EXISTS ops_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,          -- e.g., 'client.created', 'sentinel.action'
  severity TEXT NOT NULL,            -- 'info', 'warning', 'error', 'critical'
  entity_type TEXT NOT NULL,         -- 'user', 'product', 'system', 'n8n'
  entity_id TEXT,                    -- Nullable ID of the entity
  payload JSONB DEFAULT '{}',        -- PII masked details
  processed BOOLEAN DEFAULT FALSE    -- For future background processing
);

CREATE INDEX IF NOT EXISTS idx_ops_events_created ON ops_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_events_type ON ops_events (event_type);
CREATE INDEX IF NOT EXISTS idx_ops_events_entity ON ops_events (entity_type, entity_id);

-- 2. Table for Audit Log (Operator Actions)
CREATE TABLE IF NOT EXISTS ops_audit (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id INTEGER,                  -- User ID who performed the action (Nullable for system)
  actor_role TEXT,                   -- 'admin', 'system', 'cron'
  action TEXT NOT NULL,              -- e.g., 'user.block', 'retry_onboarding'
  target_id TEXT,                    -- ID of the object being acted upon
  details JSONB DEFAULT '{}',
  ip_address INET
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_created ON ops_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_actor ON ops_audit (actor_id);
