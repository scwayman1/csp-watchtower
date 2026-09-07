-- Allow explicit statement provenance states used by the reviewed historical
-- import while retaining all existing application statuses.
ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_reconciliation_status_check;
ALTER TABLE public.positions
  ADD CONSTRAINT positions_reconciliation_status_check
  CHECK (reconciliation_status = ANY (ARRAY[
    'unreviewed', 'needs_reconciliation', 'confirmed', 'auto_applied',
    'dismissed', 'statement_pending_review', 'statement_expired',
    'statement_assigned', 'statement_assigned_call_sale'
  ]));

ALTER TABLE public.covered_calls
  DROP CONSTRAINT IF EXISTS covered_calls_reconciliation_status_check;
ALTER TABLE public.covered_calls
  ADD CONSTRAINT covered_calls_reconciliation_status_check
  CHECK (reconciliation_status = ANY (ARRAY[
    'unreviewed', 'needs_reconciliation', 'confirmed', 'auto_applied',
    'dismissed', 'statement_pending_review', 'statement_expired',
    'statement_assigned', 'statement_assigned_call_sale'
  ]));
