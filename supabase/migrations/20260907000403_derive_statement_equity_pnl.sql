-- Derive statement equity P/L from source-keyed broker trade rows.
--
-- The broker's assigned-call tax gain includes the call premium.  The
-- statement premium ledger already counts that premium, so assigned stock
-- P/L must be proceeds less broker cost basis.  Non-assignment security sales
-- use the broker's final recognized gain/loss amount.  Money-market sales and
-- purchases are not capital-gain rows.

CREATE OR REPLACE FUNCTION public.reconciliation_statement_realized_gain(p_item JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_item JSONB := COALESCE(p_item->'metadata', p_item);
  v_kind TEXT := v_item->>'record_kind';
  v_description TEXT := COALESCE(v_item->>'description', '');
  v_match TEXT[];
BEGIN
  IF v_kind = 'assigned_call_stock' THEN
    -- The final three dollar values are proceeds, broker cost basis, and
    -- the broker's gain.  Use proceeds minus basis to avoid counting the
    -- assigned call's premium twice.
    v_match := regexp_match(
      v_description,
      '(\$?[0-9,]+\.[0-9]{2})\s+(\$?[0-9,]+\.[0-9]{2})\s+(\(?\$?[0-9,]+\.[0-9]{2}\)?)\s*$'
    );
    IF v_match IS NULL THEN
      RETURN 0;
    END IF;
    RETURN (
      regexp_replace(v_match[1], '[$(),]', '', 'g')::NUMERIC
      - regexp_replace(v_match[2], '[$(),]', '', 'g')::NUMERIC
    );
  END IF;

  IF v_kind = 'security_trade'
     AND v_description ~ '(ST|LT) (Gain|Loss)'
  THEN
    -- For ordinary stock/ETP sales, the final amount is the broker's net
    -- recognized gain/loss for that statement row.  Parenthesized values are
    -- losses.  This intentionally excludes cash-equivalent sales that have
    -- no ST/LT gain/loss annotation.
    v_match := regexp_match(
      v_description,
      '(\(?\$?[0-9,]+\.[0-9]{2}\)?)\s*$'
    );
    IF v_match IS NULL THEN
      RETURN 0;
    END IF;
    RETURN (
      CASE WHEN v_match[1] LIKE '(%' THEN -1 ELSE 1 END
    ) * regexp_replace(v_match[1], '[$(),]', '', 'g')::NUMERIC;
  END IF;

  RETURN 0;
END;
$function$;

COMMENT ON FUNCTION public.reconciliation_statement_realized_gain(JSONB) IS
  'Derives stock-only realized P/L from canonical broker statement trade text; assigned-call premiums are excluded because they are separately tracked in the premium ledger.';

-- Make future accounting-event applies populate the derived value whenever a
-- source payload does not already provide an explicit realizedGain field.
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

  -- Keep the legacy sections compatible with the original reconciliation
  -- function.  The only changed behavior in this replacement is the
  -- realized_gain fallback in the accountingEvents insert below.
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
      NULLIF(v_item->>'shares', '')::numeric, NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      NULLIF(v_item->>'costBasis', '')::numeric,
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'holdingKey', ''), 'equity:' || COALESCE(v_item->>'symbol', 'UNKNOWN')),
      NULLIF(v_item->>'sourceEventKey', ''), NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      COALESCE(NULLIF(v_item->>'holdingCategory', ''), 'equity'), v_item
    )
    ON CONFLICT (run_id, holding_key) DO UPDATE SET
      shares = EXCLUDED.shares, price = EXCLUDED.price,
      market_value = EXCLUDED.market_value, cost_basis = EXCLUDED.cost_basis,
      unrealized_pnl = EXCLUDED.unrealized_pnl, metadata = EXCLUDED.metadata;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload #> '{currentHoldings,options}', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_holdings (
      run_id, user_id, as_of_date, holding_type, symbol, option_type, expiration,
      strike_price, contracts, price, market_value, premium_collected, unrealized_pnl,
      liability_value, holding_key, source_event_key, source_document, source_page,
      holding_category, metadata
    ) VALUES (
      v_run_id, v_user_id, v_current_as_of, 'option', v_item->>'symbol', v_item->>'type',
      NULLIF(v_item->>'expiration', '')::date, NULLIF(v_item->>'strikePrice', '')::numeric,
      NULLIF(v_item->>'contracts', '')::numeric, NULLIF(v_item->>'price', '')::numeric,
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'premiumCollected', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'unrealizedPnl', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'marketValue', '')::numeric, 0),
      COALESCE(NULLIF(v_item->>'holdingKey', ''), 'option:' || md5(v_item::text)),
      NULLIF(v_item->>'sourceEventKey', ''), NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer, 'option', v_item
    )
    ON CONFLICT (run_id, holding_key) DO UPDATE SET
      market_value = EXCLUDED.market_value, premium_collected = EXCLUDED.premium_collected,
      unrealized_pnl = EXCLUDED.unrealized_pnl, liability_value = EXCLUDED.liability_value,
      metadata = EXCLUDED.metadata;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'lifecycleEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_date, symbol, shares, price,
      cost_basis_per_share, realized_gain, source_event_key, source_document,
      source_page, event_category, metadata
    ) VALUES (
      v_run_id, v_user_id, COALESCE(v_item->>'eventType', 'unknown'),
      NULLIF(v_item->>'eventDate', '')::date, v_item->>'symbol',
      NULLIF(v_item->>'shares', '')::numeric, NULLIF(v_item->>'price', '')::numeric,
      NULLIF(v_item->>'costBasisPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain', '')::numeric,
        (COALESCE(NULLIF(v_item->>'price', '')::numeric, 0) -
         COALESCE(NULLIF(v_item->>'costBasisPerShare', '')::numeric, 0)) *
         COALESCE(NULLIF(v_item->>'shares', '')::numeric, 0)),
      NULLIF(v_item->>'sourceEventKey', ''), NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer, 'corporate_action', v_item
    ) ON CONFLICT (run_id, source_event_key) DO NOTHING;
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'premiumEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_category, event_date, symbol,
      price, amount, source_event_key, source_document, source_page, metadata
    ) VALUES (
      v_run_id, v_user_id, 'option_open', 'option_premium',
      NULLIF(v_item->>'eventDate', '')::date, NULLIF(v_item->>'symbol', ''),
      NULLIF(v_item->>'quotedPremiumPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'statementAmount', '')::numeric, 0),
      NULLIF(v_item->>'sourceEventKey', ''), NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer, v_item
    ) ON CONFLICT (run_id, source_event_key) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'accountingEvents', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_events (
      run_id, user_id, event_type, event_category, event_date, symbol, shares,
      price, cost_basis_per_share, realized_gain, amount, already_in_baseline,
      source_event_key, source_document, source_page, metadata
    ) VALUES (
      v_run_id, v_user_id,
      COALESCE(NULLIF(v_item->>'eventType', ''), 'statement_activity'),
      COALESCE(NULLIF(v_item->>'eventCategory', ''), 'other'),
      NULLIF(v_item->>'eventDate', '')::date, NULLIF(v_item->>'symbol', ''),
      NULLIF(v_item->>'shares', '')::numeric, NULLIF(v_item->>'price', '')::numeric,
      NULLIF(v_item->>'costBasisPerShare', '')::numeric,
      COALESCE(NULLIF(v_item->>'realizedGain', '')::numeric,
        public.reconciliation_statement_realized_gain(v_item), 0),
      COALESCE(NULLIF(v_item->>'amount', '')::numeric, 0),
      COALESCE((v_item->>'alreadyInBaseline')::boolean, false),
      NULLIF(v_item->>'sourceEventKey', ''), NULLIF(v_item->>'sourceDocument', ''),
      NULLIF(v_item->>'sourcePage', '')::integer,
      COALESCE(v_item->'metadata', v_item)
    ) ON CONFLICT (run_id, source_event_key) DO NOTHING;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'reconciliationCoveredCalls', '[]'::jsonb)) LOOP
    INSERT INTO public.account_reconciliation_covered_calls (
      run_id, user_id, symbol, expiration, strike_price, contracts,
      premium_per_contract, opened_at, closed_at, status, underlying_source,
      assigned_position_id, underlying_holding_key, source_event_key, metadata
    ) VALUES (
      v_run_id, v_user_id, v_item->>'symbol', NULLIF(v_item->>'expiration', '')::date,
      NULLIF(v_item->>'strikePrice', '')::numeric, NULLIF(v_item->>'contracts', '')::numeric,
      NULLIF(v_item->>'premiumPerContract', '')::numeric,
      NULLIF(v_item->>'openedAt', '')::date, NULLIF(v_item->>'closedAt', '')::date,
      COALESCE(NULLIF(v_item->>'status', ''), 'needs_review'),
      COALESCE(NULLIF(v_item->>'underlyingSource', ''), 'unknown'),
      NULLIF(v_item->>'assignedPositionId', '')::uuid, NULLIF(v_item->>'underlyingHoldingKey', ''),
      v_item->>'sourceEventKey', COALESCE(v_item->'metadata', v_item)
    ) ON CONFLICT (run_id, source_event_key) DO UPDATE SET
      status = EXCLUDED.status, closed_at = EXCLUDED.closed_at,
      assigned_position_id = EXCLUDED.assigned_position_id,
      underlying_holding_key = EXCLUDED.underlying_holding_key, metadata = EXCLUDED.metadata;
  END LOOP;

  INSERT INTO public.user_settings (
    user_id, cash_balance, other_holdings_value, broker_account_value, broker_account_value_as_of
  ) VALUES (
    v_user_id, COALESCE((v_summary->>'currentCashBalance')::numeric, 0), 0,
    COALESCE((v_summary->>'currentAum')::numeric, 0), v_current_as_of
  ) ON CONFLICT (user_id) DO UPDATE SET
    cash_balance = EXCLUDED.cash_balance, broker_account_value = EXCLUDED.broker_account_value,
    broker_account_value_as_of = EXCLUDED.broker_account_value_as_of, updated_at = now();

  INSERT INTO public.portfolio_history (
    user_id, portfolio_value, cash_balance, positions_value, assigned_shares_value,
    total_premiums_collected, net_position_pnl, event_type, event_description, created_at
  ) VALUES (
    v_user_id, COALESCE((v_summary->>'currentAum')::numeric, 0),
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

GRANT EXECUTE ON FUNCTION public.reconciliation_statement_realized_gain(JSONB) TO authenticated;

-- Backfill the already-applied canonical run(s) without creating a second
-- run or changing any position/assignment identity.
UPDATE public.account_reconciliation_events e
SET realized_gain = public.reconciliation_statement_realized_gain(e.metadata)
WHERE e.event_category = 'security_trade'
  AND e.metadata ? 'record_kind';

-- Preserve source-backed holdings valuation when a canonical run was written
-- before cost-basis columns were populated from the statement pages.
UPDATE public.account_reconciliation_holdings h
SET cost_basis = COALESCE(h.cost_basis, NULLIF(h.metadata->>'costBasis', '')::numeric),
    unrealized_pnl = COALESCE(NULLIF(h.metadata->>'unrealizedPnl', '')::numeric, h.unrealized_pnl)
WHERE h.holding_type = 'equity'
  AND (h.cost_basis IS NULL OR h.metadata ? 'costBasis');

-- Keep the stored run/payload summaries aligned with the event-level source,
-- while explicitly withholding strategy P/L until equity cost basis is present
-- for every statement equity holding.
WITH derived AS (
  SELECT
    e.run_id,
    SUM(e.realized_gain) AS equity_realized,
    SUM(e.realized_gain) FILTER (WHERE e.metadata->>'record_kind' = 'assigned_call_stock') AS assigned_stock,
    SUM(e.realized_gain) FILTER (WHERE e.metadata->>'record_kind' = 'security_trade') AS other_stock
  FROM public.account_reconciliation_events e
  WHERE e.event_category = 'security_trade'
    AND e.metadata->>'record_kind' IN ('assigned_call_stock', 'security_trade')
  GROUP BY e.run_id
), patched AS (
  SELECT
    r.id,
    r.payload,
    r.summary || jsonb_build_object(
      'cumulativePremiumToDate', COALESCE((r.summary->>'statementPremiumNetSettlement')::numeric, (r.summary->>'cumulativePremiumToDate')::numeric, 0),
      'cumulativePremiumGrossToDate', COALESCE((r.summary->>'statementPremiumGross')::numeric, (r.summary->>'cumulativePremiumToDate')::numeric, 0),
      'realizedPremiumToDate', COALESCE((r.summary->>'realizedPremiumToDate')::numeric, 0) + COALESCE((r.summary->>'statementPremiumFees')::numeric, 0),
      'realizedPremiumGrossToDate', COALESCE((r.summary->>'realizedPremiumToDate')::numeric, 0),
      'realizedPremiumFeesToDate', COALESCE((r.summary->>'statementPremiumFees')::numeric, 0),
      'realizedCapitalGainToDate', d.equity_realized,
      'realizedCapitalGainSource', 'statement trade rows: assigned stock proceeds minus broker basis plus non-assignment recognized gains; assigned-call premium excluded',
      'totalRealizedPnl', d.equity_realized + COALESCE((r.summary->>'realizedPremiumToDate')::numeric, 0) + COALESCE((r.summary->>'statementPremiumFees')::numeric, 0),
      'currentUnrealizedPnl', (r.summary->>'currentUnrealizedPnl')::numeric,
      'totalStrategyPnl', NULL,
      'equityRealizedPnlSource', 'statement trade rows: assigned stock proceeds minus broker basis plus non-assignment recognized gains; assigned-call premium excluded',
      'equityRealizedPnlStatus', 'derived',
      'equityRealizedPnlBreakdown', jsonb_build_object(
        'assignedCallStockProceedsMinusBasis', d.assigned_stock,
        'otherSecuritySalesRecognizedGain', d.other_stock
      ),
      'equityUnrealizedPnlStatus', 'source_holdings_required',
      'strategyPnlStatus', 'derived_trading_control_pending_wheel_attribution',
      'flowAdjustedAccountValueChange', COALESCE((r.summary->>'flowAdjustedAccountValueChange')::numeric, NULL),
      'flowAdjustedAccountValueChangeStatus', 'whole_account_bridge_control_not_strategy_return',
      'postBaselineDividends', COALESCE((r.summary->>'postBaselineDividends')::numeric, NULL),
      'postBaselineFees', COALESCE((r.summary->>'postBaselineFees')::numeric, NULL),
      'nonPerformanceFlows', COALESCE((r.summary->>'nonPerformanceFlows')::numeric, NULL)
    ) AS new_summary
  FROM public.account_reconciliation_runs r
  JOIN derived d ON d.run_id = r.id
)
UPDATE public.account_reconciliation_runs r
SET summary = p.new_summary,
    payload = jsonb_set(p.payload, '{summary}', p.new_summary, false)
FROM patched p
WHERE r.id = p.id;

-- Rebuild the reader view from event-level realized gains.  Do not surface
-- stale summary P/L when statement equity cost basis is incomplete.
CREATE OR REPLACE VIEW public.current_account_reconciliation_rollup AS
WITH latest_run AS (
  SELECT DISTINCT ON (user_id)
    id, user_id, baseline_as_of, current_as_of, summary, applied_at
  FROM public.account_reconciliation_runs
  WHERE status = 'applied'
  ORDER BY user_id, current_as_of DESC, applied_at DESC
), reconciled_call_totals AS (
  SELECT run_id, COALESCE(SUM(premium_per_contract * contracts * 100), 0) AS covered_call_premium
  FROM public.account_reconciliation_covered_calls
  GROUP BY run_id
), derived_trade_totals AS (
  SELECT run_id, COALESCE(SUM(realized_gain), 0) AS equity_realized_pnl
  FROM public.account_reconciliation_events
  WHERE event_category = 'security_trade'
    AND metadata->>'record_kind' IN ('assigned_call_stock', 'security_trade')
  GROUP BY run_id
), equity_basis_state AS (
  SELECT
    run_id,
    COUNT(*) FILTER (WHERE holding_type = 'equity') AS equity_count,
    COUNT(*) FILTER (WHERE holding_type = 'equity' AND cost_basis IS NOT NULL) AS equity_cost_basis_count
  FROM public.account_reconciliation_holdings
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
  COALESCE(dtt.equity_realized_pnl, (lr.summary->>'realizedCapitalGainToDate')::numeric, 0) AS realized_capital_gain_to_date,
  COALESCE((lr.summary->>'realizedPremiumToDate')::numeric, 0)
    + COALESCE(dtt.equity_realized_pnl, (lr.summary->>'realizedCapitalGainToDate')::numeric, 0) AS total_realized_pnl,
  CASE
    WHEN ebs.equity_count > 0 AND ebs.equity_count = ebs.equity_cost_basis_count
      THEN (lr.summary->>'currentUnrealizedPnl')::numeric
    ELSE NULL
  END AS current_unrealized_pnl,
  CASE
    WHEN ebs.equity_count > 0 AND ebs.equity_count = ebs.equity_cost_basis_count
      THEN COALESCE((lr.summary->>'realizedPremiumToDate')::numeric, 0)
        + COALESCE(dtt.equity_realized_pnl, (lr.summary->>'realizedCapitalGainToDate')::numeric, 0)
        + COALESCE((lr.summary->>'currentUnrealizedPnl')::numeric, 0)
    ELSE NULL
  END AS total_strategy_pnl,
  lr.summary,
  COALESCE((lr.summary->>'postBaselineCashIncome')::numeric, 0) AS post_baseline_cash_income,
  COALESCE((lr.summary->>'postBaselineCashFees')::numeric, 0) AS post_baseline_cash_fees,
  COALESCE((lr.summary->>'postBaselineExternalFlows')::numeric, 0) AS post_baseline_external_flows,
  COALESCE((lr.summary->>'postBaselineReinvestments')::numeric, 0) AS post_baseline_reinvestments,
  COALESCE((lr.summary->>'reconciliationCoveredCallPremium')::numeric, rct.covered_call_premium, 0) AS reconciliation_covered_call_premium,
  COALESCE((lr.summary->>'statementPremiumGross')::numeric, 0) AS statement_premium_gross,
  COALESCE((lr.summary->>'statementPremiumNetSettlement')::numeric, 0) AS statement_premium_net_settlement,
  COALESCE((lr.summary->>'statementPremiumFees')::numeric, 0) AS statement_premium_fees,
  CASE WHEN dtt.run_id IS NOT NULL THEN 'derived' ELSE 'summary_only' END AS equity_realized_pnl_status,
  CASE
    WHEN ebs.equity_count > 0 AND ebs.equity_count = ebs.equity_cost_basis_count THEN 'derived'
    ELSE 'pending_cost_basis'
  END AS equity_unrealized_pnl_status,
  CASE
    WHEN ebs.equity_count > 0 AND ebs.equity_count = ebs.equity_cost_basis_count
      THEN COALESCE(lr.summary->>'strategyPnlStatus', 'derived')
    ELSE 'pending_reconciliation'
  END AS strategy_pnl_status
FROM latest_run lr
LEFT JOIN reconciled_call_totals rct ON rct.run_id = lr.id
LEFT JOIN derived_trade_totals dtt ON dtt.run_id = lr.id
LEFT JOIN equity_basis_state ebs ON ebs.run_id = lr.id;

ALTER VIEW public.current_account_reconciliation_rollup SET (security_invoker = true);
