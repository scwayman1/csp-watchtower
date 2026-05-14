-- Canonical accounting model hardening
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
    'put_assigned','put_expired_worthless','call_called_away','call_expired_worthless','needs_reconciliation'
  )),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected','confirmed','dismissed','auto_applied'
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
CREATE POLICY "Users can view their own position events" ON public.position_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own position events" ON public.position_events;
CREATE POLICY "Users can insert their own position events" ON public.position_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own position events" ON public.position_events;
CREATE POLICY "Users can update their own position events" ON public.position_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_position_events_user_status ON public.position_events(user_id, status, event_date DESC);

CREATE OR REPLACE TRIGGER update_position_events_updated_at BEFORE UPDATE ON public.position_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.portfolio_accounting_rollup AS
WITH active_puts AS (
  SELECT p.user_id,
    COALESCE(SUM(p.strike_price * p.contracts * 100), 0) AS active_put_requirement,
    COALESCE(SUM(COALESCE(od.mark_price, 0) * p.contracts * 100), 0) AS active_put_mark_value,
    COALESCE(SUM(p.premium_per_contract * p.contracts * 100), 0) AS active_put_premium,
    COUNT(*) AS open_csp_count
  FROM public.positions p LEFT JOIN public.option_data od ON od.position_id = p.id
  WHERE p.is_active = true GROUP BY p.user_id
),
assigned_source_ids AS (
  SELECT DISTINCT user_id, original_position_id FROM public.assigned_positions WHERE original_position_id IS NOT NULL
),
expired_puts AS (
  SELECT p.user_id, COALESCE(SUM(p.premium_per_contract * p.contracts * 100), 0) AS expired_put_premium
  FROM public.positions p
  LEFT JOIN assigned_source_ids asi ON asi.user_id = p.user_id AND asi.original_position_id = p.id
  WHERE p.expiration < CURRENT_DATE AND asi.original_position_id IS NULL GROUP BY p.user_id
),
assigned AS (
  SELECT ap.user_id,
    COALESCE(SUM(ap.original_put_premium), 0) AS assigned_put_premium,
    COALESCE(SUM(CASE WHEN ap.is_active THEN ap.shares * COALESCE(md.underlying_price, ap.assignment_price) ELSE 0 END), 0) AS assigned_share_market_value,
    COALESCE(SUM(CASE WHEN ap.is_active THEN ap.shares * ap.cost_basis ELSE 0 END), 0) AS assigned_share_cost_basis,
    COALESCE(SUM(CASE WHEN ap.is_active = false AND ap.sold_price IS NOT NULL THEN (ap.sold_price - ap.assignment_price) * ap.shares ELSE 0 END), 0) AS realized_capital_gains
  FROM public.assigned_positions ap LEFT JOIN public.market_data md ON md.symbol = ap.symbol GROUP BY ap.user_id
),
covered_calls AS (
  SELECT ap.user_id,
    COALESCE(SUM(CASE WHEN cc.is_active = true AND cc.expiration >= CURRENT_DATE THEN cc.premium_per_contract * cc.contracts * 100 ELSE 0 END), 0) AS active_call_premium,
    COALESCE(SUM(CASE WHEN cc.is_active = false OR cc.expiration < CURRENT_DATE THEN cc.premium_per_contract * cc.contracts * 100 ELSE 0 END), 0) AS closed_call_premium
  FROM public.covered_calls cc JOIN public.assigned_positions ap ON ap.id = cc.assigned_position_id GROUP BY ap.user_id
)
SELECT us.user_id,
  COALESCE(us.cash_balance, 0) AS cash_balance,
  COALESCE(us.other_holdings_value, 0) AS other_holdings_value,
  COALESCE(us.broker_account_value, 0) AS broker_account_value,
  COALESCE(ap.active_put_requirement, 0) AS active_put_requirement,
  COALESCE(ap.active_put_mark_value, 0) AS active_put_mark_value,
  COALESCE(a.assigned_share_market_value, 0) AS assigned_share_market_value,
  COALESCE(a.assigned_share_cost_basis, 0) AS assigned_share_cost_basis,
  COALESCE(a.realized_capital_gains, 0) AS realized_capital_gains,
  COALESCE(ap.open_csp_count, 0) AS open_csp_count,
  COALESCE(ap.active_put_premium, 0) + COALESCE(ep.expired_put_premium, 0) + COALESCE(a.assigned_put_premium, 0) + COALESCE(cc.active_call_premium, 0) + COALESCE(cc.closed_call_premium, 0) AS total_premiums_collected,
  CASE WHEN COALESCE(us.broker_account_value, 0) > 0 THEN COALESCE(us.broker_account_value, 0)
    ELSE COALESCE(us.cash_balance, 0) + COALESCE(us.other_holdings_value, 0) + COALESCE(a.assigned_share_market_value, 0) - COALESCE(ap.active_put_mark_value, 0) END AS portfolio_value,
  GREATEST(COALESCE(us.cash_balance, 0) - COALESCE(ap.active_put_requirement, 0), 0) AS available_cash
FROM public.user_settings us
LEFT JOIN active_puts ap ON ap.user_id = us.user_id
LEFT JOIN expired_puts ep ON ep.user_id = us.user_id
LEFT JOIN assigned a ON a.user_id = us.user_id
LEFT JOIN covered_calls cc ON cc.user_id = us.user_id;

CREATE OR REPLACE FUNCTION public.sync_client_metrics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_client_id UUID; v_user_id UUID; v_rollup RECORD;
BEGIN
  IF TG_TABLE_NAME = 'covered_calls' THEN
    SELECT ap.user_id INTO v_user_id FROM assigned_positions ap WHERE ap.id = COALESCE(NEW.assigned_position_id, OLD.assigned_position_id);
  ELSIF TG_OP = 'DELETE' THEN v_user_id := OLD.user_id;
  ELSE v_user_id := NEW.user_id;
  END IF;
  IF v_user_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT id INTO v_client_id FROM clients WHERE user_id = v_user_id;
  IF v_client_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT * INTO v_rollup FROM public.portfolio_accounting_rollup WHERE user_id = v_user_id;
  UPDATE clients SET portfolio_value = COALESCE(v_rollup.portfolio_value, 0),
    available_cash = COALESCE(v_rollup.available_cash, 0),
    premium_ytd = COALESCE(v_rollup.total_premiums_collected, 0),
    open_csp_count = COALESCE(v_rollup.open_csp_count, 0),
    updated_at = now()
  WHERE id = v_client_id;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Lifecycle reconciliation hardening
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS expiration_close_price NUMERIC,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreviewed' CHECK (reconciliation_status IN ('unreviewed','needs_reconciliation','confirmed','auto_applied','dismissed')),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE public.covered_calls
  ADD COLUMN IF NOT EXISTS expiration_close_price NUMERIC,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreviewed' CHECK (reconciliation_status IN ('unreviewed','needs_reconciliation','confirmed','auto_applied','dismissed')),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_positions_reconciliation_status ON public.positions(user_id, reconciliation_status, expiration DESC);
CREATE INDEX IF NOT EXISTS idx_covered_calls_reconciliation_status ON public.covered_calls(reconciliation_status, expiration DESC);

-- Account reconciliation import tables
CREATE TABLE IF NOT EXISTS public.account_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual_reconciliation',
  baseline_as_of DATE,
  current_as_of DATE NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  summary JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('draft','applied','superseded','voided')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, payload_hash)
);

CREATE TABLE IF NOT EXISTS public.account_reconciliation_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.account_reconciliation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  as_of_date DATE NOT NULL,
  holding_type TEXT NOT NULL CHECK (holding_type IN ('cash','equity','option')),
  symbol TEXT,
  option_type TEXT CHECK (option_type IS NULL OR option_type IN ('PUT','CALL')),
  expiration DATE,
  strike_price NUMERIC,
  contracts NUMERIC,
  shares NUMERIC,
  price NUMERIC,
  market_value NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC,
  premium_collected NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  liability_value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_reconciliation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.account_reconciliation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date DATE,
  symbol TEXT,
  shares NUMERIC,
  price NUMERIC,
  cost_basis_per_share NUMERIC,
  realized_gain NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  already_in_baseline BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_reconciliation_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_reconciliation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reconciliation runs" ON public.account_reconciliation_runs;
CREATE POLICY "Users can view own reconciliation runs" ON public.account_reconciliation_runs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own reconciliation runs" ON public.account_reconciliation_runs;
CREATE POLICY "Users can insert own reconciliation runs" ON public.account_reconciliation_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reconciliation runs" ON public.account_reconciliation_runs;
CREATE POLICY "Users can update own reconciliation runs" ON public.account_reconciliation_runs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own reconciliation holdings" ON public.account_reconciliation_holdings;
CREATE POLICY "Users can view own reconciliation holdings" ON public.account_reconciliation_holdings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own reconciliation events" ON public.account_reconciliation_events;
CREATE POLICY "Users can view own reconciliation events" ON public.account_reconciliation_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_runs_user_current ON public.account_reconciliation_runs(user_id, current_as_of DESC, applied_at DESC) WHERE status = 'applied';
CREATE INDEX IF NOT EXISTS idx_account_reconciliation_holdings_run ON public.account_reconciliation_holdings(run_id, holding_type, symbol);
CREATE INDEX IF NOT EXISTS idx_account_reconciliation_events_run ON public.account_reconciliation_events(run_id, event_type, symbol);

CREATE OR REPLACE VIEW public.current_account_reconciliation_rollup AS
WITH latest_run AS (
  SELECT DISTINCT ON (user_id) id, user_id, baseline_as_of, current_as_of, summary, applied_at
  FROM public.account_reconciliation_runs WHERE status = 'applied'
  ORDER BY user_id, current_as_of DESC, applied_at DESC
)
SELECT lr.id AS run_id, lr.user_id, lr.baseline_as_of, lr.current_as_of, lr.applied_at,
  COALESCE((lr.summary->>'currentAum')::numeric, 0) AS broker_account_value,
  COALESCE((lr.summary->>'currentCashBalance')::numeric, 0) AS cash_balance,
  COALESCE((lr.summary->>'currentEquityMarketValue')::numeric, 0) AS equity_market_value,
  COALESCE((lr.summary->>'currentOptionLiability')::numeric, 0) AS option_liability,
  COALESCE((lr.summary->>'currentOpenPremium')::numeric, 0) AS current_open_premium,
  COALESCE((lr.summary->>'cumulativePremiumToDate')::numeric, 0) AS cumulative_premium_to_date,
  COALESCE((lr.summary->>'realizedPremiumToDate')::numeric, 0) AS realized_premium_to_date,
  COALESCE((lr.summary->>'realizedCapitalGainToDate')::numeric, 0) AS realized_capital_gain_to_date,
  COALESCE((lr.summary->>'totalRealizedPnl')::numeric, 0) AS total_realized_pnl,
  COALESCE((lr.summary->>'currentUnrealizedPnl')::numeric, 0) AS current_unrealized_pnl,
  COALESCE((lr.summary->>'totalStrategyPnl')::numeric, 0) AS total_strategy_pnl,
  lr.summary
FROM latest_run lr;

CREATE OR REPLACE FUNCTION public.apply_account_reconciliation(p_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_run_id UUID;
  v_payload_hash TEXT;
  v_current_as_of DATE;
  v_baseline_as_of DATE;
  v_summary JSONB;
  v_item JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_summary := COALESCE(p_payload->'summary', '{}'::jsonb);
  v_current_as_of := COALESCE(NULLIF(p_payload #>> '{currentHoldings,asOfDate}', '')::date, NULLIF(v_summary->>'currentAsOfDate', '')::date, CURRENT_DATE);
  v_baseline_as_of := COALESCE(NULLIF(p_payload #>> '{baseline,asOfDate}', '')::date, NULLIF(v_summary->>'baselineAsOfDate', '')::date, NULL);
  v_payload_hash := md5(p_payload::text);

  SELECT id INTO v_run_id FROM public.account_reconciliation_runs WHERE user_id = v_user_id AND payload_hash = v_payload_hash;
  IF v_run_id IS NOT NULL THEN RETURN v_run_id; END IF;

  INSERT INTO public.account_reconciliation_runs (user_id, source, baseline_as_of, current_as_of, payload_hash, payload, summary, status)
  VALUES (v_user_id, COALESCE(p_payload->>'source', 'manual_reconciliation'), v_baseline_as_of, v_current_as_of, v_payload_hash, p_payload, v_summary, 'applied')
  RETURNING id INTO v_run_id;

  INSERT INTO public.account_reconciliation_holdings (run_id, user_id, as_of_date, holding_type, symbol, shares, market_value, unrealized_pnl, metadata)
  SELECT v_run_id, v_user_id, v_current_as_of, 'cash', 'CASH', NULL, COALESCE((v_summary->>'currentCashBalance')::numeric, 0), 0, jsonb_build_object('source','summary_cash')
  WHERE v_summary ? 'currentCashBalance';

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,equities}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (run_id, user_id, as_of_date, holding_type, symbol, shares, price, market_value, cost_basis, unrealized_pnl, metadata)
    VALUES (v_run_id, v_user_id, v_current_as_of, 'equity', v_item->>'symbol',
      NULLIF(v_item->>'shares','')::numeric, NULLIF(v_item->>'price','')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue','')::numeric, 0), NULLIF(v_item->>'costBasis','')::numeric,
      COALESCE(NULLIF(v_item->>'unrealizedPnl','')::numeric, 0), v_item);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,options}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (run_id, user_id, as_of_date, holding_type, symbol, option_type, expiration, strike_price, contracts, price, market_value, premium_collected, unrealized_pnl, liability_value, metadata)
    VALUES (v_run_id, v_user_id, v_current_as_of, 'option', v_item->>'symbol', v_item->>'type',
      NULLIF(v_item->>'expiration','')::date, NULLIF(v_item->>'strikePrice','')::numeric,
      NULLIF(v_item->>'contracts','')::numeric, NULLIF(v_item->>'price','')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue','')::numeric, 0),
      COALESCE(NULLIF(v_item->>'premiumCollected','')::numeric, 0),
      COALESCE(NULLIF(v_item->>'unrealizedPnl','')::numeric, 0),
      COALESCE(NULLIF(v_item->>'marketValue','')::numeric, 0), v_item);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lifecycleEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (run_id, user_id, event_type, event_date, symbol, shares, price, cost_basis_per_share, realized_gain, metadata)
    VALUES (v_run_id, v_user_id, COALESCE(v_item->>'eventType','unknown'), NULLIF(v_item->>'eventDate','')::date,
      v_item->>'symbol', NULLIF(v_item->>'shares','')::numeric, NULLIF(v_item->>'price','')::numeric,
      NULLIF(v_item->>'costBasisPerShare','')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain','')::numeric,
        (COALESCE(NULLIF(v_item->>'price','')::numeric, 0) - COALESCE(NULLIF(v_item->>'costBasisPerShare','')::numeric, 0)) * COALESCE(NULLIF(v_item->>'shares','')::numeric, 0)
      ), v_item);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'cashEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (run_id, user_id, event_type, event_date, amount, already_in_baseline, metadata)
    VALUES (v_run_id, v_user_id, COALESCE(v_item->>'eventType','cash_event'), NULLIF(v_item->>'eventDate','')::date,
      COALESCE(NULLIF(v_item->>'amount','')::numeric, 0),
      COALESCE((v_item->>'alreadyInBaseline')::boolean, false), v_item);
  END LOOP;

  INSERT INTO public.user_settings (user_id, cash_balance, other_holdings_value, broker_account_value, broker_account_value_as_of)
  VALUES (v_user_id, COALESCE((v_summary->>'currentCashBalance')::numeric, 0), 0,
    COALESCE((v_summary->>'currentAum')::numeric, 0), v_current_as_of)
  ON CONFLICT (user_id) DO UPDATE SET
    cash_balance = EXCLUDED.cash_balance,
    other_holdings_value = EXCLUDED.other_holdings_value,
    broker_account_value = EXCLUDED.broker_account_value,
    broker_account_value_as_of = EXCLUDED.broker_account_value_as_of,
    updated_at = now();

  INSERT INTO public.portfolio_history (user_id, portfolio_value, cash_balance, positions_value, assigned_shares_value, total_premiums_collected, net_position_pnl, event_type, event_description, created_at)
  VALUES (v_user_id,
    COALESCE((v_summary->>'currentAum')::numeric, 0),
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    COALESCE((v_summary->>'currentOptionLiability')::numeric, 0),
    COALESCE((v_summary->>'currentEquityMarketValue')::numeric, 0),
    COALESCE((v_summary->>'cumulativePremiumToDate')::numeric, 0),
    COALESCE((v_summary->>'totalStrategyPnl')::numeric, 0),
    'account_reconciliation', 'Canonical account reconciliation import', now());

  RETURN v_run_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_account_reconciliation(JSONB) TO authenticated;

-- P1 fix: map detected -> unreviewed for lifecycle source rows
CREATE OR REPLACE FUNCTION public.record_position_reconciliation_event(
  p_user_id UUID, p_event_type TEXT, p_source_table TEXT, p_source_id UUID, p_event_date DATE,
  p_status TEXT DEFAULT 'detected', p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_event_id UUID; v_reconciliation_status TEXT;
BEGIN
  IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Cannot reconcile another user portfolio'; END IF;
  v_reconciliation_status := CASE
    WHEN p_event_type = 'needs_reconciliation' THEN 'needs_reconciliation'
    WHEN p_status = 'detected' THEN 'unreviewed'
    ELSE p_status END;

  INSERT INTO public.position_events (user_id, event_type, source_table, source_id, event_date, status, metadata)
  VALUES (p_user_id, p_event_type, p_source_table, p_source_id, p_event_date, p_status, p_metadata)
  ON CONFLICT (source_table, source_id, event_type) DO UPDATE SET
    status = EXCLUDED.status, event_date = EXCLUDED.event_date, metadata = EXCLUDED.metadata, updated_at = now()
  RETURNING id INTO v_event_id;

  IF p_source_table = 'positions' THEN
    UPDATE public.positions SET reconciliation_status = v_reconciliation_status,
      reconciled_at = CASE WHEN p_status IN ('confirmed','auto_applied','dismissed') THEN now() ELSE reconciled_at END
    WHERE id = p_source_id AND user_id = p_user_id;
  ELSIF p_source_table = 'covered_calls' THEN
    UPDATE public.covered_calls cc SET reconciliation_status = v_reconciliation_status,
      reconciled_at = CASE WHEN p_status IN ('confirmed','auto_applied','dismissed') THEN now() ELSE reconciled_at END
    FROM public.assigned_positions ap WHERE cc.id = p_source_id AND cc.assigned_position_id = ap.id AND ap.user_id = p_user_id;
  END IF;

  RETURN v_event_id;
END;
$function$;