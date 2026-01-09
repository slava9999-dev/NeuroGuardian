-- Migration: Add buyer price estimation columns
-- Run this on Neon DB production

-- Add estimated_buyer_price column
ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_buyer_price INTEGER;

-- Add marketplace_discount_percent column  
ALTER TABLE products ADD COLUMN IF NOT EXISTS marketplace_discount_percent DECIMAL(5,2);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('estimated_buyer_price', 'marketplace_discount_percent');
