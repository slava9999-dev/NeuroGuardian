// ============================================
-- NeuroGUARDIAN — SaaS Database Schema (SQL)
-- Implementation for Multi-tenancy & Monetization
-- ============================================

-- 1. Subscription Plans Defining Limits
CREATE TABLE IF NOT EXISTS subscription_plans (
    id VARCHAR(50) PRIMARY KEY, -- 'trial', 'standard', 'premium'
    name VARCHAR(100) NOT NULL,
    monthly_price DECIMAL(12, 2) NOT NULL,
    products_limit INTEGER NOT NULL,
    ai_tokens_limit INTEGER NOT NULL, -- Units for AI services per month
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Subscriptions State (History and current status)
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'frozen', 'canceled'
    current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    yookassa_sub_id VARCHAR(255), -- For recurring payments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Usage Logs for Quotas tracking
CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL, -- 'ai_chat', 'vision_analyze', 'render_media'
    amount INTEGER NOT NULL DEFAULT 1, -- tokens or units
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Mandatory Indexes for Isolation Performance & Security
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_accounts_user_id ON marketplace_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_jobs_user_id ON media_jobs(user_id);

-- 5. Seed Initial Plans
INSERT INTO subscription_plans (id, name, monthly_price, products_limit, ai_tokens_limit, features)
VALUES 
('trial', 'Пробный', 0, 10, 50, '{"sentinel": true, "vision": false}'),
('standard', 'Стандарт', 999, 100, 500, '{"sentinel": true, "vision": true}'),
('premium', 'Премиум', 2999, 1000, 5000, '{"sentinel": true, "vision": true, "priority_support": true}')
ON CONFLICT (id) DO UPDATE SET 
    monthly_price = EXCLUDED.monthly_price,
    products_limit = EXCLUDED.products_limit,
    ai_tokens_limit = EXCLUDED.ai_tokens_limit;
