-- Replay protection for pasted/imported orders.
-- Keys are supplied by the importer and are deliberately nullable so this
-- migration does not rewrite or merge historical financial records.
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS ingestion_key TEXT;

ALTER TABLE public.assigned_positions
  ADD COLUMN IF NOT EXISTS raw_order_text TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_key TEXT;

ALTER TABLE public.covered_calls
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS raw_order_text TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_user_ingestion_key
  ON public.positions(user_id, ingestion_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assigned_positions_user_ingestion_key
  ON public.assigned_positions(user_id, ingestion_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_covered_calls_assigned_ingestion_key
  ON public.covered_calls(assigned_position_id, ingestion_key);

COMMENT ON COLUMN public.positions.ingestion_key IS
  'Stable per-row import identity. Replaying an import is ignored; null preserves legacy rows.';
COMMENT ON COLUMN public.assigned_positions.ingestion_key IS
  'Stable per-row import identity for share purchases. This is not a broker transaction id.';
COMMENT ON COLUMN public.covered_calls.ingestion_key IS
  'Stable per-row import identity for covered calls. This is not a broker transaction id.';

-- Used only for reporting/previewing duplicate candidates. It does not delete,
-- update, or otherwise mutate live financial data.
CREATE OR REPLACE VIEW public.order_ingestion_duplicate_preview AS
SELECT user_id, ingestion_key, 'positions'::TEXT AS source_table, COUNT(*) AS row_count
FROM public.positions
WHERE ingestion_key IS NOT NULL
GROUP BY user_id, ingestion_key
HAVING COUNT(*) > 1
UNION ALL
SELECT user_id, ingestion_key, 'assigned_positions'::TEXT, COUNT(*)
FROM public.assigned_positions
WHERE ingestion_key IS NOT NULL
GROUP BY user_id, ingestion_key
HAVING COUNT(*) > 1
UNION ALL
SELECT user_id, ingestion_key, 'covered_calls'::TEXT, COUNT(*)
FROM public.covered_calls
WHERE ingestion_key IS NOT NULL
GROUP BY user_id, ingestion_key
HAVING COUNT(*) > 1;

ALTER VIEW public.order_ingestion_duplicate_preview SET (security_invoker = true);
GRANT SELECT ON public.order_ingestion_duplicate_preview TO authenticated;

COMMENT ON VIEW public.order_ingestion_duplicate_preview IS
  'Read-only preview of duplicate import keys. It never mutates live financial data.';
