-- Reconciliation support for complete broker statements.
-- This migration deliberately keeps statement facts separate from the
-- assignment-only strategy tables. It is safe to stage/apply a statement
-- snapshot without fabricating assigned_positions rows for purchased,
-- transferred, or otherwise non-assignment stock.

ALTER TABLE public.account_reconciliation_events
  ADD COLUMN IF NOT EXISTS source_event_key TEXT,
  ADD COLUMN IF NOT EXISTS source_document TEXT,
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS event_category TEXT;

ALTER TABLE public.account_reconciliation_holdings
  ADD COLUMN IF NOT EXISTS holding_key TEXT,
  ADD COLUMN IF NOT EXISTS source_event_key TEXT,
  ADD COLUMN IF NOT EXISTS source_document TEXT,
  ADD COLUMN IF NOT EXISTS source_page INTEGER,
  ADD COLUMN IF NOT EXISTS holding_category TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_reconciliation_events_run_source
  ON public.account_reconciliation_events(run_id, source_event_key);

-- A nullable key already permits multiple legacy NULLs under PostgreSQL's
-- normal UNIQUE semantics. Keep this index non-partial so the RPC can use
-- ON CONFLICT (run_id, holding_key) for idempotent snapshot upserts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_reconciliation_holdings_run_key
  ON public.account_reconciliation_holdings(run_id, holding_key);

-- Covered calls on statement-reported stock that is not represented by
-- assigned_positions. Rows here are snapshot evidence; the existing
-- public.covered_calls table remains the strategy ledger for assigned stock.
CREATE TABLE IF NOT EXISTS public.account_reconciliation_covered_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.account_reconciliation_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  expiration DATE NOT NULL,
  strike_price NUMERIC NOT NULL,
  contracts NUMERIC NOT NULL,
  premium_per_contract NUMERIC NOT NULL,
  opened_at DATE,
  closed_at DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired', 'assigned', 'needs_review')),
  underlying_source TEXT NOT NULL DEFAULT 'unknown' CHECK (underlying_source IN ('assigned_position', 'reconciliation_holding', 'purchased_or_transferred', 'unknown')),
  assigned_position_id UUID REFERENCES public.assigned_positions(id) ON DELETE SET NULL,
  underlying_holding_key TEXT,
  source_event_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, source_event_key),
  CHECK (assigned_position_id IS NOT NULL OR underlying_holding_key IS NOT NULL OR underlying_source = 'unknown')
);

ALTER TABLE public.account_reconciliation_covered_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reconciliation covered calls" ON public.account_reconciliation_covered_calls;
CREATE POLICY "Users can view own reconciliation covered calls"
  ON public.account_reconciliation_covered_calls FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reconciliation covered calls" ON public.account_reconciliation_covered_calls;
CREATE POLICY "Users can insert own reconciliation covered calls"
  ON public.account_reconciliation_covered_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reconciliation covered calls" ON public.account_reconciliation_covered_calls;
CREATE POLICY "Users can update own reconciliation covered calls"
  ON public.account_reconciliation_covered_calls FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_covered_calls_run
  ON public.account_reconciliation_covered_calls(run_id, status, symbol);

CREATE INDEX IF NOT EXISTS idx_account_reconciliation_covered_calls_user_source
  ON public.account_reconciliation_covered_calls(user_id, source_event_key);

-- Normalize generic statement accounting rows into the existing events table.
-- Legacy payloads remain supported; accountingEvents is additive.
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
  WHERE user_id = v_user_id AND payload_hash = v_payload_hash;

  IF v_run_id IS NOT NULL THEN
    RETURN v_run_id;
  END IF;

  INSERT INTO public.account_reconciliation_runs (
    user_id, source, baseline_as_of, current_as_of, payload_hash, payload, summary, status
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
    run_id, user_id, as_of_date, holding_type, symbol, shares, market_value,
    unrealized_pnl, holding_key, source_event_key, source_document, source_page,
    holding_category, metadata
  )
  SELECT
    v_run_id, v_user_id, v_current_as_of, 'cash', 'CASH', NULL,
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0), 0,
    'summary:CASH', 'summary:CASH', NULL, NULL, 'cash_equivalent',
    jsonb_build_object('source', 'summary_cash')
  WHERE v_summary ? 'currentCashBalance';

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,equities}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (
      run_id, user_id, as_of_date, holding_type, symbol, shares, price, market_value,
      cost_basis, unrealized_pnl, holding_key, source_event_key, source_document,
      source_page, holding_category, metadata
    ) VALUES (
      v_run_id, v_user_id, v_current_as_of, 'equity', v_item->>'symbol',
      NULLIF(v_item->>'shares', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      NULLIF(v_item->>'costBasis', '')::numeric,
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'holdingKey', ''), 'equity:' || COALESCE(v_item->>'symbol', 'UNKNOWN')),
      NULLIF(v_item->>'sourceEventKey', ''),
      NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      COALESCE(NULLIF(v_item->>'holdingCategory', ''), 'equity'),
      v_item
    )
    ON CONFLICT (run_id, holding_key) DO UPDATE SET
      shares = EXCLUDED.shares,
      price = EXCLUDED.price,
      market_value = EXCLUDED.market_value,
      cost_basis = EXCLUDED.cost_basis,
      unrealized_pnl = EXCLUDED.unrealized_pnl,
      metadata = EXCLUDED.metadata;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,options}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (
      run_id, user_id, as_of_date, holding_type, symbol, option_type, expiration,
      strike_price, contracts, price, market_value, premium_collected, unrealized_pnl,
      liability_value, holding_key, source_event_key, source_document, source_page,
      holding_category, metadata
    ) VALUES (
      v_run_id, v_user_id, v_current_as_of, 'option', v_item->>'symbol', v_item->>'type',
      NULLIF(v_item->>'expiration', '')::date,
      NULLIF(v_item->>'strikePrice', '')::numeric,
      NULLIF(v_item->>'contracts', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'premiumCollected', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'holdingKey', ''), 'option:' || md5(v_item::text)),
      NULLIF(v_item->>'sourceEventKey', ''),
      NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      'option',
      v_item
    )
    ON CONFLICT (run_id, holding_key) DO UPDATE SET
      market_value = EXCLUDED.market_value,
      premium_collected = EXCLUDED.premium_collected,
      unrealized_pnl = EXCLUDED.unrealized_pnl,
      liability_value = EXCLUDED.liability_value,
      metadata = EXCLUDED.metadata;
  END LOOP;

  -- Existing lifecycle events remain compatible with prior payloads.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lifecycleEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_date, symbol, shares, price,
      cost_basis_per_share, realized_gain, source_event_key, source_document,
      source_page, event_category, metadata
    ) VALUES (
      v_run_id, v_user_id, COALESCE(v_item->>'eventType', 'unknown'),
      NULLIF(v_item->>'eventDate', '')::date, v_item->>'symbol',
      NULLIF(v_item->>'shares', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      NULLIF(v_item->>'costBasisPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain', '')::numeric,
        (COALESCE(NULLIF(v_item->>'price', '')::numeric, 0) -
         COALESCE(NULLIF(v_item->>'costBasisPerShare', '')::numeric, 0)) *
         COALESCE(NULLIF(v_item->>'shares', '')::numeric, 0)),
      NULLIF(v_item->>'sourceEventKey', ''),
      NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      'corporate_action',
      v_item
    )
    ON CONFLICT (run_id, source_event_key) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'cashEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_date, amount, already_in_baseline, metadata
    ) VALUES (
      v_run_id, v_user_id, COALESCE(v_item->>'eventType', 'cash_event'),
      NULLIF(v_item->>'eventDate', '')::date,
      COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0),
      COALESCE((v_item->>'alreadyInBaseline')::boolean, false), v_item
    );
  END LOOP;

  -- Canonical option openings are the verified lifetime premium ledger. Keep
  -- quoted gross, statement settlement, and explicit fee delta together in
  -- one source-keyed event row; assignment rows remain transfer-only.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'premiumEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_category, event_date, symbol,
      price, amount, source_event_key, source_document, source_page, metadata
    ) VALUES (
      v_run_id, v_user_id, 'option_open', 'option_premium',
      NULLIF(v_item->>'eventDate', '')::date,
      NULLIF(v_item->>'symbol', ''),
      NULLIF(v_item->>'quotedPremiumPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'statementAmount', '')::numeric, 0),
      NULLIF(v_item->>'sourceEventKey', ''),
      NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      v_item
    )
    ON CONFLICT (run_id, source_event_key) DO NOTHING;
  END LOOP;

  -- Generic statement activity: dividends, fees, transfers, trades,
  -- reinvestments, and corporate actions. Amount is signed as supplied.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'accountingEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_category, event_date, symbol, shares,
      price, cost_basis_per_share, realized_gain, amount, already_in_baseline,
      source_event_key, source_document, source_page, metadata
    ) VALUES (
      v_run_id, v_user_id,
      COALESCE(NULLIF(v_item->>'eventType', ''), 'statement_activity'),
      COALESCE(NULLIF(v_item->>'eventCategory', ''), 'other'),
      NULLIF(v_item->>'eventDate', '')::date,
      NULLIF(v_item->>'symbol', ''),
      NULLIF(v_item->>'shares', '')::numeric,
      NULLIF(v_item->>'price', '')::numeric,
      NULLIF(v_item->>'costBasisPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0),
      COALESCE((v_item->>'alreadyInBaseline')::boolean, false),
      NULLIF(v_item->>'sourceEventKey', ''),
      NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      COALESCE(v_item->'metadata', v_item)
    )
    ON CONFLICT (run_id, source_event_key) DO NOTHING;
  END LOOP;

  -- Calls whose stock parent is not an assignment are retained here rather
  -- than inserted into covered_calls with a fabricated assigned_position_id.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'reconciliationCoveredCalls', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_covered_calls (
      run_id, user_id, symbol, expiration, strike_price, contracts,
      premium_per_contract, opened_at, closed_at, status, underlying_source,
      assigned_position_id, underlying_holding_key, source_event_key, metadata
    ) VALUES (
      v_run_id, v_user_id, v_item->>'symbol',
      NULLIF(v_item->>'expiration', '')::date,
      NULLIF(v_item->>'strikePrice', '')::numeric,
      NULLIF(v_item->>'contracts', '')::numeric,
      NULLIF(v_item->>'premiumPerContract', '')::numeric,
      NULLIF(v_item->>'openedAt', '')::date,
      NULLIF(v_item->>'closedAt', '')::date,
      COALESCE(NULLIF(v_item->>'status', ''), 'needs_review'),
      COALESCE(NULLIF(v_item->>'underlyingSource', ''), 'unknown'),
      NULLIF(v_item->>'assignedPositionId', '')::uuid,
      NULLIF(v_item->>'underlyingHoldingKey', ''),
      v_item->>'sourceEventKey',
      COALESCE(v_item->'metadata', v_item)
    )
    ON CONFLICT (run_id, source_event_key) DO UPDATE SET
      status = EXCLUDED.status,
      closed_at = EXCLUDED.closed_at,
      assigned_position_id = EXCLUDED.assigned_position_id,
      underlying_holding_key = EXCLUDED.underlying_holding_key,
      metadata = EXCLUDED.metadata;
  END LOOP;

  INSERT INTO public.user_settings (
    user_id, cash_balance, other_holdings_value, broker_account_value, broker_account_value_as_of
  ) VALUES (
    v_user_id,
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    0,
    COALESCE((v_summary->>'currentAum')::numeric, 0),
    v_current_as_of
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cash_balance = EXCLUDED.cash_balance,
    broker_account_value = EXCLUDED.broker_account_value,
    broker_account_value_as_of = EXCLUDED.broker_account_value_as_of,
    updated_at = now();

  INSERT INTO public.portfolio_history (
    user_id, portfolio_value, cash_balance, positions_value, assigned_shares_value,
    total_premiums_collected, net_position_pnl, event_type, event_description, created_at
  ) VALUES (
    v_user_id,
    COALESCE((v_summary->>'currentAum')::numeric, 0),
    COALESCE((v_summary->>'currentCashBalance')::numeric, 0),
    COALESCE((v_summary->>'currentOptionLiability')::numeric, 0),
    COALESCE((v_summary->>'currentEquityMarketValue')::numeric, 0),
    COALESCE((v_summary->>'cumulativePremiumToDate')::numeric, 0),
    COALESCE((v_summary->>'totalStrategyPnl')::numeric, 0),
    'account_reconciliation', 'Canonical account reconciliation import', now()
  );

  RETURN v_run_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_account_reconciliation(JSONB) TO authenticated;

COMMENT ON TABLE public.account_reconciliation_covered_calls IS
  'Snapshot statement covered-call evidence, including calls on purchased/transferred stock that cannot be linked to assigned_positions; this is not a lifetime ledger, and the core covered_calls table remains the lifetime strategy ledger.';
COMMENT ON COLUMN public.account_reconciliation_events.source_event_key IS
  'Deterministic source key within a reconciliation run for statement-event traceability.';

-- Expose the new controls to readers of the current-run rollup without
-- changing the existing columns consumed by the dashboard.
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
), reconciled_call_totals AS (
  SELECT
    run_id,
    COALESCE(SUM(premium_per_contract * contracts * 100), 0) AS covered_call_premium
  FROM public.account_reconciliation_covered_calls
  GROUP BY run_id
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
  lr.summary,
  COALESCE((lr.summary->>'postBaselineCashIncome')::numeric, 0) AS post_baseline_cash_income,
  COALESCE((lr.summary->>'postBaselineCashFees')::numeric, 0) AS post_baseline_cash_fees,
  COALESCE((lr.summary->>'postBaselineExternalFlows')::numeric, 0) AS post_baseline_external_flows,
  COALESCE((lr.summary->>'postBaselineReinvestments')::numeric, 0) AS post_baseline_reinvestments,
  COALESCE((lr.summary->>'reconciliationCoveredCallPremium')::numeric, rct.covered_call_premium, 0) AS reconciliation_covered_call_premium,
  COALESCE((lr.summary->>'statementPremiumGross')::numeric, 0) AS statement_premium_gross,
  COALESCE((lr.summary->>'statementPremiumNetSettlement')::numeric, 0) AS statement_premium_net_settlement,
  COALESCE((lr.summary->>'statementPremiumFees')::numeric, 0) AS statement_premium_fees
FROM latest_run lr
LEFT JOIN reconciled_call_totals rct ON rct.run_id = lr.id;

ALTER VIEW public.current_account_reconciliation_rollup SET (security_invoker = true);
