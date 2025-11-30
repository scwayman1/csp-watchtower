
-- Function to sync client metrics from investor portfolio
CREATE OR REPLACE FUNCTION sync_client_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_portfolio_value NUMERIC;
  v_available_cash NUMERIC;
  v_premium_ytd NUMERIC;
  v_open_csp_count INTEGER;
BEGIN
  -- Find client record for this user
  SELECT id INTO v_client_id
  FROM clients
  WHERE user_id = NEW.user_id;
  
  -- Only proceed if user has a client record
  IF v_client_id IS NOT NULL THEN
    -- Get user settings
    SELECT 
      COALESCE(cash_balance, 0) + COALESCE(other_holdings_value, 0)
    INTO v_portfolio_value
    FROM user_settings
    WHERE user_id = NEW.user_id;
    
    -- Calculate available cash (liquid capital)
    -- Total premiums collected
    WITH premium_totals AS (
      SELECT COALESCE(SUM(premium_per_contract * contracts), 0) as active_premiums
      FROM positions
      WHERE user_id = NEW.user_id AND is_active = true
      
      UNION ALL
      
      SELECT COALESCE(SUM(original_put_premium), 0) as assigned_premiums
      FROM assigned_positions
      WHERE user_id = NEW.user_id AND is_active = true
      
      UNION ALL
      
      SELECT COALESCE(SUM(premium_per_contract * contracts), 0) as covered_call_premiums
      FROM covered_calls cc
      JOIN assigned_positions ap ON cc.assigned_position_id = ap.id
      WHERE ap.user_id = NEW.user_id AND cc.is_active = true
    ),
    -- Total assigned cost basis
    assigned_cost AS (
      SELECT COALESCE(SUM(cost_basis * shares), 0) as total_assigned_cost
      FROM assigned_positions
      WHERE user_id = NEW.user_id AND is_active = true
    )
    SELECT 
      v_portfolio_value + 
      (SELECT SUM(active_premiums) FROM premium_totals) - 
      (SELECT total_assigned_cost FROM assigned_cost)
    INTO v_available_cash;
    
    -- Calculate premium YTD (all collected premiums)
    WITH all_premiums AS (
      SELECT COALESCE(SUM(premium_per_contract * contracts), 0) as total
      FROM positions
      WHERE user_id = NEW.user_id
      
      UNION ALL
      
      SELECT COALESCE(SUM(original_put_premium), 0) as total
      FROM assigned_positions
      WHERE user_id = NEW.user_id
      
      UNION ALL
      
      SELECT COALESCE(SUM(premium_per_contract * contracts), 0) as total
      FROM covered_calls cc
      JOIN assigned_positions ap ON cc.assigned_position_id = ap.id
      WHERE ap.user_id = NEW.user_id
    )
    SELECT SUM(total) INTO v_premium_ytd FROM all_premiums;
    
    -- Count open CSP positions
    SELECT COUNT(*) INTO v_open_csp_count
    FROM positions
    WHERE user_id = NEW.user_id AND is_active = true;
    
    -- Update client record
    UPDATE clients
    SET 
      portfolio_value = v_portfolio_value,
      available_cash = v_available_cash,
      premium_ytd = v_premium_ytd,
      open_csp_count = v_open_csp_count,
      updated_at = now()
    WHERE id = v_client_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers on relevant tables
CREATE OR REPLACE TRIGGER sync_client_on_settings_change
AFTER INSERT OR UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION sync_client_metrics();

CREATE OR REPLACE TRIGGER sync_client_on_position_change
AFTER INSERT OR UPDATE OR DELETE ON positions
FOR EACH ROW
EXECUTE FUNCTION sync_client_metrics();

CREATE OR REPLACE TRIGGER sync_client_on_assigned_position_change
AFTER INSERT OR UPDATE OR DELETE ON assigned_positions
FOR EACH ROW
EXECUTE FUNCTION sync_client_metrics();

CREATE OR REPLACE TRIGGER sync_client_on_covered_call_change
AFTER INSERT OR UPDATE OR DELETE ON covered_calls
FOR EACH ROW
EXECUTE FUNCTION sync_client_metrics();
