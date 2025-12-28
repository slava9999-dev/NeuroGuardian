-- ============================================
-- NeuroGUARDIAN Security Agent - ClickHouse Schema
-- ============================================
-- Immutable audit logs with HMAC signing
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS security_audit;

-- Main audit logs table (append-only, immutable)
CREATE TABLE IF NOT EXISTS security_audit.audit_logs
(
    -- Event identification
    id UUID DEFAULT generateUUIDv4(),
    event String NOT NULL,                    -- e.g., 'price.update', 'secret.access', 'auth.denied'
    category LowCardinality(String) NOT NULL, -- 'security', 'data', 'auth', 'admin'
    severity LowCardinality(String) NOT NULL, -- 'info', 'warning', 'critical'
    
    -- Actor information
    user_id String NOT NULL,
    user_ip IPv4,
    user_agent String,
    session_id String,
    
    -- Request context
    trace_id String NOT NULL,                 -- For distributed tracing
    request_path String,
    request_method LowCardinality(String),
    
    -- Event data (before/after for changes)
    before_state String,                      -- JSON string
    after_state String,                       -- JSON string
    metadata String,                          -- Additional context as JSON
    
    -- Security & integrity
    signature FixedString(64) NOT NULL,       -- HMAC-SHA256 signature
    signature_version UInt8 DEFAULT 1,
    
    -- Timestamps
    timestamp DateTime64(3) DEFAULT now64(3),
    created_at DateTime64(3) DEFAULT now64(3),
    
    -- TTL for GDPR compliance (optional, set to 0 to keep forever)
    ttl_days UInt16 DEFAULT 365
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (category, event, timestamp, user_id)
TTL timestamp + INTERVAL ttl_days DAY
SETTINGS index_granularity = 8192;

-- Index for fast user-based queries
ALTER TABLE security_audit.audit_logs ADD INDEX idx_user_id user_id TYPE bloom_filter(0.01) GRANULARITY 1;

-- Index for event type queries
ALTER TABLE security_audit.audit_logs ADD INDEX idx_event event TYPE bloom_filter(0.01) GRANULARITY 1;

-- Index for trace-based queries
ALTER TABLE security_audit.audit_logs ADD INDEX idx_trace_id trace_id TYPE bloom_filter(0.01) GRANULARITY 1;


-- Policy decisions cache table
CREATE TABLE IF NOT EXISTS security_audit.policy_decisions
(
    id UUID DEFAULT generateUUIDv4(),
    policy_id String NOT NULL,
    user_id String NOT NULL,
    resource_type String NOT NULL,
    resource_id String,
    action String NOT NULL,
    decision LowCardinality(String) NOT NULL,  -- 'allow', 'deny'
    reason String,
    cached_until DateTime64(3),
    request_latency_ms UInt32,
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, policy_id, timestamp)
TTL timestamp + INTERVAL 7 DAY
SETTINGS index_granularity = 8192;


-- Secret access logs (sensitive operations)
CREATE TABLE IF NOT EXISTS security_audit.secret_access_logs
(
    id UUID DEFAULT generateUUIDv4(),
    user_id String NOT NULL,
    secret_name String NOT NULL,
    purpose String NOT NULL,
    access_granted Bool NOT NULL,
    ttl_seconds UInt32,
    source_ip IPv4,
    user_agent String,
    trace_id String NOT NULL,
    signature FixedString(64) NOT NULL,
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (secret_name, timestamp, user_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;


-- Rate limiting events
CREATE TABLE IF NOT EXISTS security_audit.rate_limit_events
(
    id UUID DEFAULT generateUUIDv4(),
    user_id String NOT NULL,
    endpoint String NOT NULL,
    limit_type LowCardinality(String) NOT NULL,  -- 'requests', 'tokens', 'api_calls'
    current_count UInt32,
    max_count UInt32,
    window_seconds UInt32,
    blocked Bool NOT NULL,
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (user_id, endpoint, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;


-- n8n workflow execution logs
CREATE TABLE IF NOT EXISTS security_audit.workflow_executions
(
    id UUID DEFAULT generateUUIDv4(),
    workflow_id String NOT NULL,
    workflow_name String NOT NULL,
    execution_id String NOT NULL,
    node_name String,
    node_type String,
    status LowCardinality(String) NOT NULL,  -- 'started', 'completed', 'failed'
    signature_verified Bool NOT NULL,
    credentials_injected Array(String),
    error_message String,
    execution_time_ms UInt32,
    trace_id String NOT NULL,
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (workflow_id, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;


-- Security incidents (P0 events)
CREATE TABLE IF NOT EXISTS security_audit.security_incidents
(
    id UUID DEFAULT generateUUIDv4(),
    incident_type LowCardinality(String) NOT NULL,  -- 'secret_leak', 'auth_bypass', 'data_breach'
    severity LowCardinality(String) NOT NULL,       -- 'P0', 'P1', 'P2'
    title String NOT NULL,
    description String NOT NULL,
    affected_users Array(String),
    affected_resources Array(String),
    detection_method String NOT NULL,
    auto_remediation_applied Bool DEFAULT false,
    remediation_actions Array(String),
    resolved Bool DEFAULT false,
    resolved_at DateTime64(3),
    resolved_by String,
    trace_id String NOT NULL,
    signature FixedString(64) NOT NULL,
    timestamp DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (severity, incident_type, timestamp)
SETTINGS index_granularity = 8192;

-- Materialized view for real-time security metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS security_audit.security_metrics_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(period)
ORDER BY (period, event_category, event_type)
AS SELECT
    toStartOfHour(timestamp) AS period,
    category AS event_category,
    event AS event_type,
    count() AS event_count,
    countIf(severity = 'critical') AS critical_count,
    uniqExact(user_id) AS unique_users
FROM security_audit.audit_logs
GROUP BY period, event_category, event_type;

-- View for quick security dashboard
CREATE VIEW IF NOT EXISTS security_audit.dashboard_summary AS
SELECT
    toDate(timestamp) AS date,
    count() AS total_events,
    countIf(severity = 'critical') AS critical_events,
    countIf(category = 'auth' AND event LIKE '%denied%') AS auth_denials,
    countIf(category = 'security') AS security_events,
    uniqExact(user_id) AS active_users
FROM security_audit.audit_logs
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY date
ORDER BY date DESC;

-- Grant permissions
GRANT SELECT, INSERT ON security_audit.* TO security_agent;
-- NOTE: No DELETE or UPDATE permissions - logs are immutable!
