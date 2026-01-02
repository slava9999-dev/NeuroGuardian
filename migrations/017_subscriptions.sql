-- Migration 017: Subscriptions System
-- Created: 2026-01-02
-- Purpose: Monetization foundation - subscriptions, trials, payments

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Subscription Status
  status VARCHAR(20) NOT NULL DEFAULT 'trial',
  -- Possible values: 'trial', 'active', 'past_due', 'cancelled', 'expired'
  
  -- Subscription Tier
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  -- Possible values: 'free', 'basic', 'pro', 'business'
  
  -- Trial Period
  trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Billing
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  
  -- Payment
  payment_method VARCHAR(50), -- 'yookassa', 'tinkoff', etc.
  last_payment_at TIMESTAMP WITH TIME ZONE,
  last_payment_amount DECIMAL(10, 2),
  
  -- Limits based on tier
  max_products INTEGER DEFAULT 50,
  max_accounts INTEGER DEFAULT 1,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'basic', 'pro', 'business')),
  CONSTRAINT one_subscription_per_user UNIQUE (user_id)
);

-- Index for quick status lookups
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE status = 'active';

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Payment Details
  payment_id VARCHAR(255) UNIQUE NOT NULL, -- External payment ID (YooKassa, etc.)
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Possible values: 'pending', 'succeeded', 'failed', 'cancelled', 'refunded'
  
  -- Payment Provider
  provider VARCHAR(50) NOT NULL, -- 'yookassa', 'tinkoff', 'stripe'
  provider_data JSONB, -- Raw provider response
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded'))
);

-- Indexes for payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_id ON payments(payment_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================================================
-- SUBSCRIPTION TIERS CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  tier VARCHAR(20) PRIMARY KEY,
  name_ru VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2),
  
  -- Limits
  max_products INTEGER NOT NULL,
  max_accounts INTEGER NOT NULL,
  
  -- Features
  features JSONB NOT NULL DEFAULT '[]',
  
  -- Display
  display_order INTEGER NOT NULL DEFAULT 0,
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO subscription_tiers (tier, name_ru, name_en, price_monthly, price_yearly, max_products, max_accounts, features, display_order, is_popular) VALUES
('free', 'Бесплатный', 'Free', 0, 0, 10, 1, 
  '["Базовый AI ассистент", "Мониторинг до 10 товаров", "1 магазин"]'::jsonb, 
  1, false),
  
('basic', 'Базовый', 'Basic', 999, 9990, 50, 1, 
  '["Полный AI ассистент Viktor", "Защита цен 24/7", "Мониторинг до 50 товаров", "1 магазин", "Умные уведомления", "ABC анализ"]'::jsonb, 
  2, true),
  
('pro', 'Профессиональный', 'Pro', 2999, 29990, 500, 3, 
  '["Всё из Базового", "До 500 товаров", "3 магазина", "Приоритетная поддержка", "Расширенная аналитика", "Прогнозы продаж"]'::jsonb, 
  3, false),
  
('business', 'Бизнес', 'Business', 9999, 99990, 999999, 10, 
  '["Всё из Профессионального", "Безлимит товаров", "До 10 магазинов", "Персональный менеджер", "API доступ", "Кастомные интеграции"]'::jsonb, 
  4, false)
ON CONFLICT (tier) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-create subscription on user registration
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, status, tier, trial_ends_at)
  VALUES (NEW.id, 'trial', 'free', NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create subscription for new users
DROP TRIGGER IF EXISTS trigger_create_subscription ON users;
CREATE TRIGGER trigger_create_subscription
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- Function to check if subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR(20);
  v_trial_ends_at TIMESTAMP WITH TIME ZONE;
  v_current_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT status, trial_ends_at, current_period_end
  INTO v_status, v_trial_ends_at, v_current_period_end
  FROM subscriptions
  WHERE user_id = p_user_id;
  
  -- No subscription found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check trial
  IF v_status = 'trial' AND v_trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  -- Check active subscription
  IF v_status = 'active' AND (v_current_period_end IS NULL OR v_current_period_end > NOW()) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to update subscription status based on dates
CREATE OR REPLACE FUNCTION update_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Expire trials
  UPDATE subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'trial' 
    AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Expire active subscriptions
  UPDATE subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND current_period_end < NOW();
  
  GET DIAGNOSTICS v_updated = v_updated + ROW_COUNT;
  
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscriptions IS 'User subscription management with trial and paid tiers';
COMMENT ON TABLE payments IS 'Payment transaction history';
COMMENT ON TABLE subscription_tiers IS 'Available subscription plans configuration';
COMMENT ON FUNCTION is_subscription_active IS 'Check if user has active subscription (trial or paid)';
COMMENT ON FUNCTION update_expired_subscriptions IS 'Cron job to expire old subscriptions';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE ON subscriptions TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON payments TO your_app_user;
-- GRANT SELECT ON subscription_tiers TO your_app_user;
