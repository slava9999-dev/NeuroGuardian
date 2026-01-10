-- Migration 019: Add notifications_mode to users table
-- Allows users to control notification frequency
-- 'all' = send report every 30 minutes (default, original behavior)
-- 'threats_only' = only notify when threats/actions/errors occur

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notifications_mode VARCHAR(20) DEFAULT 'all';

-- Add comment for documentation
COMMENT ON COLUMN users.notifications_mode IS 'Controls Sentinel notification frequency: all (every 30 min) or threats_only (only when issues found)';
