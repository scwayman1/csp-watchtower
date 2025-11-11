-- Add intraday data fields to market_data table
ALTER TABLE market_data 
ADD COLUMN IF NOT EXISTS day_open numeric,
ADD COLUMN IF NOT EXISTS day_change_pct numeric,
ADD COLUMN IF NOT EXISTS intraday_prices jsonb;