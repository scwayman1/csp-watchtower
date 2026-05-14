-- Fix P1 review findings from canonical reconciliation merge.
-- 1. record_position_reconciliation_event writes position_events.status='detected',
--    but positions/covered_calls.reconciliation_status does not allow 'detected'.
--    Map detected -> unreviewed before updating lifecycle source rows.
-- 2. The TypeScript premium roll-forward now requires post-baseline premiums only;
--    this migration documents the database side so already-applied environments get
--    the corrected function definition even if the earlier migration already ran.

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
  v_reconciliation_status TEXT;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot reconcile another user portfolio';
  END IF;

  v_reconciliation_status := CASE
    WHEN p_event_type = 'needs_reconciliation' THEN 'needs_reconciliation'
    WHEN p_status = 'detected' THEN 'unreviewed'
    ELSE p_status
  END;

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
      reconciliation_status = v_reconciliation_status,
      reconciled_at = CASE
        WHEN p_status IN ('confirmed', 'auto_applied', 'dismissed') THEN now()
        ELSE reconciled_at
      END
    WHERE id = p_source_id
      AND user_id = p_user_id;
  ELSIF p_source_table = 'covered_calls' THEN
    UPDATE public.covered_calls cc
    SET
      reconciliation_status = v_reconciliation_status,
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
