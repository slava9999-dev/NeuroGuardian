-- ============================================
-- Migration 001: Initial Schema - Users Table
-- NeuroGUARDIAN Database Setup
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,                              -- Telegram user ID
    username VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    api_key_wb TEXT,
    api_key_ozon TEXT,
    ozon_client_id VARCHAR(255),
    protection_enabled BOOLEAN DEFAULT false,
    defense_mode VARCHAR(50) DEFAULT 'zero_stock',
    subscription_plan VARCHAR(50) DEFAULT 'trial',
    subscription_end TIMESTAMP,
    subscription_active BOOLEAN DEFAULT false,
    payment_method_id VARCHAR(255),
    total_products INTEGER DEFAULT 0,
    triggered_today INTEGER DEFAULT 0,
    saved_amount DECIMAL(12, 2) DEFAULT 0,
    referral_code VARCHAR(50) UNIQUE,
    referred_by VARCHAR(50),
    last_reminder_sent TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for protection checks (Sentinel cron)
CREATE INDEX IF NOT EXISTS idx_users_protection 
    ON users(protection_enabled, subscription_active) 
    WHERE protection_enabled = true;
