-- Lifecycle reconciliation hardening
-- Adds explicit expiration-close evidence fields so assignment/called-away outcomes
-- are based on statement/market-close data rather than stale current prices.

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS expiration_close_price NUMERIC,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreviewed' CHECK (reconciliation_status IN (
    'unreviewed',
    'needs_reconciliation',
    'confirmed',
    'auto_applied',
    'dismissed'
  )),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE public.covered_calls
  ADD COLUMN IF NOT EXISTS expiration_close_price NUMERIC,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unreviewed' CHECK (reconciliation_status IN (
    'unreviewed',
    'needs_reconciliation',
    'confirmed',
    'auto_applied',
    'dismissed'
  )),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.positions.expiration_close_price IS
  'Underlying close price on expiration date. Required evidence for deterministic put assignment/expiry reconciliation.';
COMMENT ON COLUMN public.covered_calls.expiration_close_price IS
  'Underlying close price on expiration date. Required evidence for deterministic covered-call called-away/expired reconciliation.';
COMMENT ON COLUMN public.positions.reconciliation_status IS
  'Lifecycle reconciliation state for this put; replaces browser-local processed flags.';
COMMENT ON COLUMN public.covered_calls.reconciliation_status IS
  'Lifecycle reconciliation state for this covered call; replaces repeated browser prompts.';

CREATE INDEX IF NOT EXISTS idx_positions_reconciliation_status
  ON public.positions(user_id, reconciliation_status, expiration DESC);

CREATE INDEX IF NOT EXISTS idx_covered_calls_reconciliation_status
  ON public.covered_calls(reconciliation_status, expiration DESC);

CREATE OR REPLACE FUNCTION public.record_position_reconciliation_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_source_table TEXT,
  p_source_id UUID,
  p_event_date DATE,
  p_status TEXT DEFAULT 'detected',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot reconcile another user portfolio';
  END IF;

  INSERT INTO public.position_events (
    user_id,
    event_type,
    source_table,
    source_id,
    event_date,
    status,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_source_table,
    p_source_id,
    p_event_date,
    p_status,
    p_metadata
  )
  ON CONFLICT (source_table, source_id, event_type)
  DO UPDATE SET
    status = EXCLUDED.status,
    event_date = EXCLUDED.event_date,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_event_id;

  IF p_source_table = 'positions' THEN
    UPDATE public.positions
    SET
      reconciliation_status = CASE
        WHEN p_event_type = 'needs_reconciliation' THEN 'needs_reconciliation'
        ELSE p_status
      END,
      reconciled_at = CASE
        WHEN p_status IN ('confirmed', 'auto_applied', 'dismissed') THEN now()
        ELSE reconciled_at
      END
    WHERE id = p_source_id
      AND user_id = p_user_id;
  ELSIF p_source_table = 'covered_calls' THEN
    UPDATE public.covered_calls cc
    SET
      reconciliation_status = CASE
        WHEN p_event_type = 'needs_reconciliation' THEN 'needs_reconciliation'
        ELSE p_status
      END,
      reconciled_at = CASE
        WHEN p_status IN ('confirmed', 'auto_applied', 'dismissed') THEN now()
        ELSE reconciled_at
      END
    FROM public.assigned_positions ap
    WHERE cc.id = p_source_id
      AND cc.assigned_position_id = ap.id
      AND ap.user_id = p_user_id;
  END IF;

  RETURN v_event_id;
END;
$function$;
