-- Ensure pgcrypto extension is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create vision_cache table for storing AI image analysis results
CREATE TABLE IF NOT EXISTS vision_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash TEXT NOT NULL,
    image_url TEXT NOT NULL,
    analysis_result JSONB NOT NULL,
    model_version TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by hash
CREATE INDEX IF NOT EXISTS idx_vision_cache_hash ON vision_cache(image_hash);
CREATE INDEX IF NOT EXISTS idx_vision_cache_url ON vision_cache(image_url);

-- Comments
COMMENT ON TABLE vision_cache IS 'Cache for expensive Vision AI analysis results';
COMMENT ON COLUMN vision_cache.image_hash IS 'Hash of the image content or URL to detect duplicates';
