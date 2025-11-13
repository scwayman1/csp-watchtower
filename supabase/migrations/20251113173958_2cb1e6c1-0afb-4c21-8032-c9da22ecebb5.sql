-- Create learning_positions table for practice trades
CREATE TABLE public.learning_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  strike_price NUMERIC NOT NULL,
  expiration DATE NOT NULL,
  contracts INTEGER NOT NULL DEFAULT 1,
  premium_per_contract NUMERIC NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own learning positions"
  ON public.learning_positions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning positions"
  ON public.learning_positions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning positions"
  ON public.learning_positions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning positions"
  ON public.learning_positions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_learning_positions_updated_at
  BEFORE UPDATE ON public.learning_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_learning_positions_user_id ON public.learning_positions(user_id);
CREATE INDEX idx_learning_positions_symbol ON public.learning_positions(symbol);
CREATE INDEX idx_learning_positions_is_active ON public.learning_positions(is_active);