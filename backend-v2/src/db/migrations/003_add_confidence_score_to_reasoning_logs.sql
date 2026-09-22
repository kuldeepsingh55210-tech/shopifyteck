-- Migration 003: Add confidence_score to reasoning_logs and ensure min_confidence on merchant_settings
ALTER TABLE reasoning_logs ADD COLUMN IF NOT EXISTS confidence_score INTEGER;
ALTER TABLE merchant_settings ADD COLUMN IF NOT EXISTS min_confidence INTEGER DEFAULT 50;
