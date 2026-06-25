-- Migration: Add gateway_url and fallback_provider to llm_settings

ALTER TABLE llm_settings
ADD COLUMN IF NOT EXISTS gateway_url TEXT,
ADD COLUMN IF NOT EXISTS fallback_provider VARCHAR(50);
