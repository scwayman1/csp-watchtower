-- Preserve statement-derived lifecycle status on assigned stock without
-- changing the assignment economics or existing rows.
ALTER TABLE public.assigned_positions
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT;
