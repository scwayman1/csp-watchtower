-- Canonical account reconciliation import layer
-- Stores statement/current-vintage repair payloads as auditable, idempotent runs
-- and exposes a rollup that the dashboard/backend can use instead of rewriting
-- financial facts from scattered UI state.

CREATE TABLE IF NOT EXISTS public.account_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual_reconciliation',
  baseline_as_of DATE,
  current_as_of DATE NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  summary JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('draft', 'applied', 'superseded', 'voided')),
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
  holding_type TEXT NOT NULL CHECK (holding_type IN ('cash', 'equity', 'option')),
  symbol TEXT,
  option_type TEXT CHECK (option_type IS NULL OR option_type IN ('PUT', 'CALL')),
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
CREATE POLICY "Users can view own reconciliation runs"
  ON public.account_reconciliation_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reconciliation runs" ON public.account_reconciliation_runs;
CREATE POLICY "Users can insert own reconciliation runs"
  ON public.account_reconciliation_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reconciliation runs" ON public.account_reconciliation_runs;
CREATE POLICY "Users can update own reconciliation runs"
  ON public.account_reconciliation_runs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own reconciliation holdings" ON public.account_reconciliation_holdings;
CREATE POLICY "Users can view own reconciliation holdings"
  ON public.account_reconciliation_holdings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own reconciliation events" ON public.account_reconciliation_events;
CREATE POLICY "Users can view own reconciliation events"
  ON public.account_reconciliation_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_runs_user_current
  ON public.account_reconciliation_runs(user_id, current_as_of DESC, applied_at DESC)
  WHERE status = 'applied';

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_holdings_run
  ON public.account_reconciliation_holdings(run_id, holding_type, symbol);

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_events_run
  ON public.account_reconciliation_events(run_id, event_type, symbol);

CREATE OR REPLACE VIEW public.current_account_reconciliation_rollup AS
WITH latest_run AS (
  SELECT DISTINCT ON (user_id)
    id,
    user_id,
    baseline_as_of,
    current_as_of,
    summary,
    applied_at
  FROM public.account_reconciliation_runs
  WHERE status = 'applied'
  ORDER BY user_id, current_as_of DESC, applied_at DESC
)
SELECT
  lr.id AS run_id,
  lr.user_id,
  lr.baseline_as_of,
  lr.current_as_of,
  lr.applied_at,
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
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_run_id UUID;
  v_payload_hash TEXT;
  v_current_as_of DATE;
  v_baseline_as_of DATE;
  v_summary JSONB;
  v_item JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_summary := COALESCE(p_payload->'summary', '{}'::jsonb);
  v_current_as_of := COALESCE(
    NULLIF(p_payload #>> '{currentHoldings,asOfDate}', '')::date,
    NULLIF(v_summary->>'currentAsOfDate', '')::date,
    CURRENT_DATE
  );
  v_baseline_as_of := COALESCE(
    NULLIF(p_payload #>> '{baseline,asOfDate}', '')::date,
    NULLIF(v_summary->>'baselineAsOfDate', '')::date,
    NULL
  );
  v_payload_hash := md5(p_payload::text);

  SELECT id INTO v_run_id
  FROM public.account_reconciliation_runs
  WHERE user_id = v_user_id
    AND payload_hash = v_payload_hash;

  IF v_run_id IS NOT NULL THEN
    RETURN v_run_id;
  END IF;

  INSERT INTO public.account_reconciliation_runs (
    user_id,
    source,
    baseline_as_of,
    current_as_of,
    payload_hash,
    payload,
    summary,
    status
  ) VALUES (
    v_user_id,
    COALESCE(p_payload->>'source', 'manual_reconciliation'),
    v_baseline_as_of,
    v_current_as_of,
    v_payload_hash,
    p_payload,
    v_summary,
    'applied'
  ) RETURNING id INTO v_run_id;

  INSERT INTO public.account_reconciliation_holdings (
    run_id, user_id, as_of_date, holding_type, symbol, shares, market_value, unrealized_pnl, metadata
  )
  SELECT
    v_run_id,
    v_user_id,
    v_current_as_of,
    'cash',
    'CASH',
    NULL,
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    0,
    jsonb_build_object('source', 'summary_cash')
  WHERE v_summary ? 'currentCashBalance';

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,equities}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (
      run_id, user_id, as_of_date, holding_type, symbol, shares, price, market_value, cost_basis, unrealized_pnl, metadata
    ) VALUES (
      v_run_id,
      v_user_id,
      v_current_as_of,
      'equity',
      v_item->>'symbol',
      NULLIF(v_item->>'shares', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      NULLIF(v_item->>'costBasis', '')::numeric,
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      v_item
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,options}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (
      run_id, user_id, as_of_date, holding_type, symbol, option_type, expiration, strike_price,
      contracts, price, market_value, premium_collected, unrealized_pnl, liability_value, metadata
    ) VALUES (
      v_run_id,
      v_user_id,
      v_current_as_of,
      'option',
      v_item->>'symbol',
      v_item->>'type',
      NULLIF(v_item->>'expiration', '')::date,
      NULLIF(v_item->>'strikePrice', '')::numeric,
      NULLIF(v_item->>'contracts', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'premiumCollected', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      v_item
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lifecycleEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_date, symbol, shares, price, cost_basis_per_share, realized_gain, metadata
    ) VALUES (
      v_run_id,
      v_user_id,
      COALESCE(v_item->>'eventType', 'unknown'),
      NULLIF(v_item->>'eventDate', '')::date,
      v_item->>'symbol',
      NULLIF(v_item->>'shares', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      NULLIF(v_item->>'costBasisPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain', '')::numeric,
        (COALESCE(NULLIF(v_item->>'price', '')::numeric, 0) - COALESCE(NULLIF(v_item->>'costBasisPerShare', '')::numeric, 0))
        * COALESCE(NULLIF(v_item->>'shares', '')::numeric, 0)
      ),
      v_item
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'cashEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_date, amount, already_in_baseline, metadata
    ) VALUES (
      v_run_id,
      v_user_id,
      COALESCE(v_item->>'eventType', 'cash_event'),
      NULLIF(v_item->>'eventDate', '')::date,
      COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0),
      COALESCE((v_item->>'alreadyInBaseline')::boolean, false),
      v_item
    );
  END LOOP;

  INSERT INTO public.user_settings (
    user_id,
    cash_balance,
    other_holdings_value,
    broker_account_value,
    broker_account_value_as_of
  ) VALUES (
    v_user_id,
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    0,
    COALESCE((v_summary->>'currentAum')::numeric, 0),
    v_current_as_of
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cash_balance = EXCLUDED.cash_balance,
    other_holdings_value = EXCLUDED.other_holdings_value,
    broker_account_value = EXCLUDED.broker_account_value,
    broker_account_value_as_of = EXCLUDED.broker_account_value_as_of,
    updated_at = now();

  INSERT INTO public.portfolio_history (
    user_id,
    portfolio_value,
    cash_balance,
    positions_value,
    assigned_shares_value,
    total_premiums_collected,
    net_position_pnl,
    event_type,
    event_description,
    created_at
  ) VALUES (
    v_user_id,
    COALESCE((v_summary->>'currentAum')::numeric, 0),
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    COALESCE((v_summary->>'currentOptionLiability')::numeric, 0),
    COALESCE((v_summary->>'currentEquityMarketValue')::numeric, 0),
    COALESCE((v_summary->>'cumulativePremiumToDate')::numeric, 0),
    COALESCE((v_summary->>'totalStrategyPnl')::numeric, 0),
    'account_reconciliation',
    'Canonical account reconciliation import',
    now()
  );

  RETURN v_run_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_account_reconciliation(JSONB) TO authenticated;

COMMENT ON TABLE public.account_reconciliation_runs IS
  'Auditable, idempotent reconciliation runs for statement/current-vintage repair payloads.';
COMMENT ON FUNCTION public.apply_account_reconciliation(JSONB) IS
  'Applies a canonical reconciliation payload for auth.uid(): stores the raw payload, normalized holdings/events, updates account settings, and records a portfolio history snapshot transactionally.';
