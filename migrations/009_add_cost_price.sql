-- Migration 009: Add cost_price column for real unit economics calculation
-- NeuroGUARDIAN - Making analytics honest

-- Add cost_price column to products table
-- This allows users to store their actual COGS (Cost of Goods Sold)
-- enabling accurate profit margin and unit economics calculations

ALTER TABLE products
ADD COLUMN IF NOT EXISTS cost_price INTEGER DEFAULT 0;

-- Add column for supplier/manufacturer code (optional, for reference)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS supplier_sku VARCHAR(100);

-- Add column for category (for more accurate commission calculations)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category VARCHAR(255);

-- Comment on columns for documentation
COMMENT ON COLUMN products.cost_price IS 'Cost of Goods Sold (COGS) in RUB - entered by user for accurate profit calculations';
COMMENT ON COLUMN products.supplier_sku IS 'Optional supplier/manufacturer SKU for reference';
COMMENT ON COLUMN products.category IS 'Product category for marketplace commission calculations';

-- Create index for cost_price lookups (for analytics)
CREATE INDEX IF NOT EXISTS idx_products_cost_price 
ON products(cost_price) 
WHERE cost_price > 0;

-- Useful composite index for unit economics queries
CREATE INDEX IF NOT EXISTS idx_products_economics 
ON products(user_id, marketplace, current_price, cost_price) 
WHERE cost_price > 0;
