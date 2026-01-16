-- Add tax_rate column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 7.00;

COMMENT ON COLUMN users.tax_rate IS 'Personal tax rate percentage (e.g., 6.00 or 7.00 for USN)';
