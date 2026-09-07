-- Permit the signed-in dashboard to read the current reconciliation snapshot
-- and its separately source-linked covered-call evidence.
GRANT SELECT ON public.current_account_reconciliation_rollup TO authenticated;
GRANT SELECT ON public.account_reconciliation_holdings TO authenticated;
GRANT SELECT ON public.account_reconciliation_covered_calls TO authenticated;
