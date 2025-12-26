-- ============================================
-- Migration 005: Chat History Table
-- NeuroGUARDIAN Database Setup
-- ============================================

CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for user chat history lookup
CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_id);
