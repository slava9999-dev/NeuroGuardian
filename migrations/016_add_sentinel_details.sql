-- Migration: 016_add_sentinel_details
-- Description: Add JSONB column for detailed decision context in sentinel logs
-- Date: 2025-12-30

ALTER TABLE sentinel_logs 
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

COMMENT ON COLUMN sentinel_logs.details IS 'Structured context of the decision (competitor price, strategy used, math)';
