-- ============================================
-- NeuroGUARDIAN — State Management Migration
-- Adds user_state table for agent state tracking
-- Version: 5.0.0 | Date: January 2026
-- ============================================

-- User state table for tracking conversation context
CREATE TABLE IF NOT EXISTS user_state (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_state_updated ON user_state(updated_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_state_updated_at ON user_state;
CREATE TRIGGER user_state_updated_at
    BEFORE UPDATE ON user_state
    FOR EACH ROW
    EXECUTE FUNCTION update_user_state_timestamp();

-- Long-term memory facts table (for RAG)
CREATE TABLE IF NOT EXISTS memory_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_type VARCHAR(50) NOT NULL, -- 'user_preference', 'product_info', 'business_rule', 'resolved_issue'
    content TEXT NOT NULL,
    embedding VECTOR(384), -- For semantic search (if pgvector enabled)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    relevance_score FLOAT DEFAULT 1.0
);

-- Indexes for memory facts
CREATE INDEX IF NOT EXISTS idx_memory_facts_user ON memory_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_facts_type ON memory_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_memory_facts_created ON memory_facts(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE user_state IS 'Stores agent conversation state for contextual responses';
COMMENT ON TABLE memory_facts IS 'Stores long-term memory facts for RAG retrieval';
COMMENT ON COLUMN user_state.state_data IS 'JSON containing: marketplace, pendingAction, awaitingInput, lastMentionedProducts, etc.';
