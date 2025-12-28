-- ============================================
-- Migration 011: Add ozon_client_id to users
-- Fixes: column "ozon_client_id" does not exist
-- ============================================

-- Add ozon_client_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'ozon_client_id'
    ) THEN
        ALTER TABLE users ADD COLUMN ozon_client_id VARCHAR(255);
        RAISE NOTICE 'Added ozon_client_id column to users table';
    ELSE
        RAISE NOTICE 'ozon_client_id column already exists';
    END IF;
END $$;

-- Verification query (run to confirm)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;
