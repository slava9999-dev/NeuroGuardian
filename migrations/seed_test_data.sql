-- ============================================
-- Test Data for NeuroGUARDIAN Development
-- Run this in Neon SQL Editor for testing
-- ============================================

-- Test User 1: Active Pro subscriber with WB products
INSERT INTO users (id, username, first_name, last_name, subscription_plan, subscription_end, subscription_active, protection_enabled, defense_mode, api_key_wb, referral_code)
VALUES (
    123456789,
    'test_user_pro',
    'Тест',
    'Пользователь',
    'pro',
    NOW() + INTERVAL '30 days',
    true,
    true,
    'zero_stock',
    'test_wb_api_key_placeholder',
    'NGTEST1'
) ON CONFLICT (id) DO UPDATE SET
    subscription_plan = EXCLUDED.subscription_plan,
    subscription_end = EXCLUDED.subscription_end,
    subscription_active = EXCLUDED.subscription_active;

-- Test User 2: Trial user with Ozon products
INSERT INTO users (id, username, first_name, subscription_plan, subscription_end, subscription_active, protection_enabled, defense_mode, api_key_ozon, ozon_client_id, referral_code)
VALUES (
    987654321,
    'test_user_trial',
    'Триал',
    'trial',
    NOW() + INTERVAL '3 days',
    true,
    true,
    'price_correction',
    'test_ozon_api_key_placeholder',
    'test_ozon_client_id',
    'NGTEST2'
) ON CONFLICT (id) DO UPDATE SET
    subscription_plan = EXCLUDED.subscription_plan,
    subscription_end = EXCLUDED.subscription_end;

-- Test User 3: Expired subscription
INSERT INTO users (id, username, first_name, subscription_plan, subscription_end, subscription_active, protection_enabled, referral_code)
VALUES (
    111222333,
    'test_user_expired',
    'Истёкший',
    'basic',
    NOW() - INTERVAL '5 days',
    false,
    false,
    'NGTEST3'
) ON CONFLICT (id) DO NOTHING;

-- Test Products for User 1 (WB)
INSERT INTO products (user_id, product_id, nm_id, title, current_price, min_price, marketplace, status, is_monitored)
VALUES 
    (123456789, '12345678', 12345678, 'Тестовый товар WB #1', 1999, 1500, 'WB', 'active', true),
    (123456789, '23456789', 23456789, 'Тестовый товар WB #2', 2999, 2500, 'WB', 'active', true),
    (123456789, '34567890', 34567890, 'Тестовый товар WB #3 (без защиты)', 999, 0, 'WB', 'active', false)
ON CONFLICT (user_id, product_id) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    min_price = EXCLUDED.min_price;

-- Test Products for User 2 (Ozon)
INSERT INTO products (user_id, product_id, offer_id, title, current_price, min_price, marketplace, status, is_monitored)
VALUES 
    (987654321, 'ozon-001', 'OFFER-001', 'Тестовый товар Ozon #1', 1499, 1200, 'Ozon', 'active', true),
    (987654321, 'ozon-002', 'OFFER-002', 'Тестовый товар Ozon #2', 3499, 3000, 'Ozon', 'active', true)
ON CONFLICT (user_id, product_id) DO UPDATE SET
    current_price = EXCLUDED.current_price,
    min_price = EXCLUDED.min_price,
    offer_id = EXCLUDED.offer_id;

-- Test Sentinel Logs
INSERT INTO sentinel_logs (user_id, product_id, product_title, detected_price, min_price, defense_action, saved_amount, marketplace)
VALUES 
    (123456789, '12345678', 'Тестовый товар WB #1', 1400, 1500, 'zero_stock', 100, 'WB'),
    (987654321, 'ozon-001', 'Тестовый товар Ozon #1', 1100, 1200, 'price_correction', 100, 'Ozon');

-- Verify data
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Products:', COUNT(*) FROM products
UNION ALL
SELECT 'Sentinel Logs:', COUNT(*) FROM sentinel_logs;

-- Show test users
SELECT id, username, subscription_plan, subscription_active, protection_enabled 
FROM users 
WHERE id IN (123456789, 987654321, 111222333);
