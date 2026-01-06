-- Add unique constraint on position_id for option_data table
ALTER TABLE public.option_data ADD CONSTRAINT option_data_position_id_unique UNIQUE (position_id);