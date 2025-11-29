-- Add cash_balance and other_holdings to user_settings for portfolio tracking
ALTER TABLE user_settings 
ADD COLUMN cash_balance numeric DEFAULT 0,
ADD COLUMN other_holdings_value numeric DEFAULT 0;

COMMENT ON COLUMN user_settings.cash_balance IS 'Cash available including money market funds (e.g., FDRXX)';
COMMENT ON COLUMN user_settings.other_holdings_value IS 'Value of other holdings not tracked as positions (e.g., OWSCX, CEDIX, mutual funds)';