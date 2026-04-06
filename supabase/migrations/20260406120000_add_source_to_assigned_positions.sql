-- Add source column to track how shares were acquired (put assignment vs direct purchase)
ALTER TABLE public.assigned_positions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'assignment';

-- Backfill: all existing rows came from put assignments
UPDATE public.assigned_positions SET source = 'assignment' WHERE source IS NULL;

-- Same for learning table
ALTER TABLE public.learning_assigned_positions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'assignment';

UPDATE public.learning_assigned_positions SET source = 'assignment' WHERE source IS NULL;
