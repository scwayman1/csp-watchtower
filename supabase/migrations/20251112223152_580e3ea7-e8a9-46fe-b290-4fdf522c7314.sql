-- Remove unused api_key column from user_settings table
-- This column was used for Polygon API integration which has been sunsetted
-- Only Yahoo Finance is now used, which doesn't require API keys
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS api_key;