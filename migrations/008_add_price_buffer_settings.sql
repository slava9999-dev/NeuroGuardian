-- ============================================
-- MIGRATION 008: Add Price Buffer Settings
-- ============================================
-- Date: 2024-12-26
-- Purpose: Add buffer settings for marketplace card discounts
-- ============================================

-- Add card discount buffer to users table
-- This accounts for hidden discounts from Ozon Card (up to 30%) and WB Pay (up to 6%)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS price_buffer_percent INTEGER DEFAULT 5;

-- Add warning threshold (alert before stop-loss triggers)
-- When price is within this % of min_price, send a warning
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS warning_threshold_percent INTEGER DEFAULT 10;

-- Add marketplace-specific buffers to products table
-- Allows per-product customization of protection levels
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS card_discount_buffer INTEGER DEFAULT 0;

-- Comment explanations for the new columns
COMMENT ON COLUMN users.price_buffer_percent IS 'Extra buffer % added to min_price to account for card discounts (Ozon Card, WB Pay)';
COMMENT ON COLUMN users.warning_threshold_percent IS 'Send warning when price is within this % of min_price';
COMMENT ON COLUMN products.card_discount_buffer IS 'Per-product card discount buffer (overrides user setting if > 0)';
