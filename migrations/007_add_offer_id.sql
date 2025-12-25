-- Add offer_id column to products table
-- This is needed for Ozon price updates (Sentinel defense)

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS offer_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_offer_id ON products(offer_id);

-- Add comment
COMMENT ON COLUMN products.offer_id IS 'Ozon offer_id (required for price updates)';
