-- Canonical accounting model hardening
-- Separates broker-reported account value from manually-entered "other holdings"
-- and fixes advisor/client rollups to use contract-dollar option premiums.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS broker_account_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS broker_account_value_as_of DATE;

COMMENT ON COLUMN public.user_settings.cash_balance IS
  'Current cash and money-market balance. Do not use as a historical baseline.';
COMMENT ON COLUMN public.user_settings.other_holdings_value IS
  'Current value of holdings not otherwise modeled by CSP Watchtower.';
COMMENT ON COLUMN public.user_settings.broker_account_value IS
  'Optional broker-reported total account value/AUM. When present, this is authoritative for AUM and premiums/gains must not be added on top.';
COMMENT ON COLUMN public.user_settings.broker_account_value_as_of IS
  'Statement date for broker_account_value.';

CREATE TABLE IF NOT EXISTS public.position_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'put_assigned',
    'put_expired_worthless',
    'call_called_away',
    'call_expired_worthless',
    'needs_reconciliation'
  )),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected',
    'confirmed',
    'dismissed',
    'auto_applied'
  )),
  event_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id, event_type)
);

ALTER TABLE public.position_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own position events" ON public.position_events;
CREATE POLICY "Users can view their own position events"
ON public.position_events FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own position events" ON public.position_events;
CREATE POLICY "Users can insert their own position events"
ON public.position_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own position events" ON public.position_events;
CREATE POLICY "Users can update their own position events"
ON public.position_events FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_position_events_user_status
  ON public.position_events(user_id, status, event_date DESC);

CREATE OR REPLACE TRIGGER update_position_events_updated_at
BEFORE UPDATE ON public.position_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.portfolio_accounting_rollup AS
WITH active_puts AS (
  SELECT
    p.user_id,
    COALESCE(SUM(p.strike_price * p.contracts * 100), 0) AS active_put_requirement,
    COALESCE(SUM(COALESCE(od.mark_price, 0) * p.contracts * 100), 0) AS active_put_mark_value,
    COALESCE(SUM(p.premium_per_contract * p.contracts * 100), 0) AS active_put_premium,
    COUNT(*) AS open_csp_count
  FROM public.positions p
  LEFT JOIN public.option_data od ON od.position_id = p.id
  WHERE p.is_active = true
  GROUP BY p.user_id
),
assigned_source_ids AS (
  SELECT DISTINCT user_id, original_position_id
  FROM public.assigned_positions
  WHERE original_position_id IS NOT NULL
),
expired_puts AS (
  SELECT
    p.user_id,
    COALESCE(SUM(p.premium_per_contract * p.contracts * 100), 0) AS expired_put_premium
  FROM public.positions p
  LEFT JOIN assigned_source_ids asi
    ON asi.user_id = p.user_id
   AND asi.original_position_id = p.id
  WHERE p.expiration < CURRENT_DATE
    AND asi.original_position_id IS NULL
  GROUP BY p.user_id
),
assigned AS (
  SELECT
    ap.user_id,
    COALESCE(SUM(ap.original_put_premium), 0) AS assigned_put_premium,
    COALESCE(SUM(CASE WHEN ap.is_active THEN ap.shares * COALESCE(md.underlying_price, ap.assignment_price) ELSE 0 END), 0) AS assigned_share_market_value,
    COALESCE(SUM(CASE WHEN ap.is_active THEN ap.shares * ap.cost_basis ELSE 0 END), 0) AS assigned_share_cost_basis,
    COALESCE(SUM(CASE WHEN ap.is_active = false AND ap.sold_price IS NOT NULL THEN (ap.sold_price - ap.assignment_price) * ap.shares ELSE 0 END), 0) AS realized_capital_gains
  FROM public.assigned_positions ap
  LEFT JOIN public.market_data md ON md.symbol = ap.symbol
  GROUP BY ap.user_id
),
covered_calls AS (
  SELECT
    ap.user_id,
    COALESCE(SUM(CASE WHEN cc.is_active = true AND cc.expiration >= CURRENT_DATE THEN cc.premium_per_contract * cc.contracts * 100 ELSE 0 END), 0) AS active_call_premium,
    COALESCE(SUM(CASE WHEN cc.is_active = false OR cc.expiration < CURRENT_DATE THEN cc.premium_per_contract * cc.contracts * 100 ELSE 0 END), 0) AS closed_call_premium
  FROM public.covered_calls cc
  JOIN public.assigned_positions ap ON ap.id = cc.assigned_position_id
  GROUP BY ap.user_id
)
SELECT
  us.user_id,
  COALESCE(us.cash_balance, 0) AS cash_balance,
  COALESCE(us.other_holdings_value, 0) AS other_holdings_value,
  COALESCE(us.broker_account_value, 0) AS broker_account_value,
  COALESCE(ap.active_put_requirement, 0) AS active_put_requirement,
  COALESCE(ap.active_put_mark_value, 0) AS active_put_mark_value,
  COALESCE(a.assigned_share_market_value, 0) AS assigned_share_market_value,
  COALESCE(a.assigned_share_cost_basis, 0) AS assigned_share_cost_basis,
  COALESCE(a.realized_capital_gains, 0) AS realized_capital_gains,
  COALESCE(ap.open_csp_count, 0) AS open_csp_count,
  COALESCE(ap.active_put_premium, 0)
    + COALESCE(ep.expired_put_premium, 0)
    + COALESCE(a.assigned_put_premium, 0)
    + COALESCE(cc.active_call_premium, 0)
    + COALESCE(cc.closed_call_premium, 0) AS total_premiums_collected,
  CASE
    WHEN COALESCE(us.broker_account_value, 0) > 0 THEN COALESCE(us.broker_account_value, 0)
    ELSE COALESCE(us.cash_balance, 0)
      + COALESCE(us.other_holdings_value, 0)
      + COALESCE(a.assigned_share_market_value, 0)
      - COALESCE(ap.active_put_mark_value, 0)
  END AS portfolio_value,
  GREATEST(COALESCE(us.cash_balance, 0) - COALESCE(ap.active_put_requirement, 0), 0) AS available_cash
FROM public.user_settings us
LEFT JOIN active_puts ap ON ap.user_id = us.user_id
LEFT JOIN expired_puts ep ON ep.user_id = us.user_id
LEFT JOIN assigned a ON a.user_id = us.user_id
LEFT JOIN covered_calls cc ON cc.user_id = us.user_id;

CREATE OR REPLACE FUNCTION public.sync_client_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id UUID;
  v_user_id UUID;
  v_rollup RECORD;
BEGIN
  IF TG_TABLE_NAME = 'covered_calls' THEN
    SELECT ap.user_id INTO v_user_id
    FROM assigned_positions ap
    WHERE ap.id = COALESCE(NEW.assigned_position_id, OLD.assigned_position_id);
  ELSIF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_client_id
  FROM clients
  WHERE user_id = v_user_id;

  IF v_client_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO v_rollup
  FROM public.portfolio_accounting_rollup
  WHERE user_id = v_user_id;

  UPDATE clients
  SET
    portfolio_value = COALESCE(v_rollup.portfolio_value, 0),
    available_cash = COALESCE(v_rollup.available_cash, 0),
    premium_ytd = COALESCE(v_rollup.total_premiums_collected, 0),
    open_csp_count = COALESCE(v_rollup.open_csp_count, 0),
    updated_at = now()
  WHERE id = v_client_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
