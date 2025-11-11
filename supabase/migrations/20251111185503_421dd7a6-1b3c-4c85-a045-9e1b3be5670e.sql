-- Create table for tracking assigned shares (when puts get exercised)
CREATE TABLE public.assigned_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  shares INTEGER NOT NULL,
  assignment_date DATE NOT NULL,
  assignment_price NUMERIC NOT NULL,
  original_put_premium NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  closed_at TIMESTAMP WITH TIME ZONE,
  sold_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tracking covered calls sold on assigned shares
CREATE TABLE public.covered_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_position_id UUID NOT NULL REFERENCES public.assigned_positions(id) ON DELETE CASCADE,
  strike_price NUMERIC NOT NULL,
  expiration DATE NOT NULL,
  premium_per_contract NUMERIC NOT NULL,
  contracts INTEGER NOT NULL DEFAULT 1,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.assigned_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covered_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assigned_positions
CREATE POLICY "Users can view their own assigned positions"
  ON public.assigned_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assigned positions"
  ON public.assigned_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assigned positions"
  ON public.assigned_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assigned positions"
  ON public.assigned_positions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for covered_calls
CREATE POLICY "Users can view covered calls for their assigned positions"
  ON public.covered_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assigned_positions
      WHERE assigned_positions.id = covered_calls.assigned_position_id
        AND assigned_positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert covered calls for their assigned positions"
  ON public.covered_calls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assigned_positions
      WHERE assigned_positions.id = covered_calls.assigned_position_id
        AND assigned_positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update covered calls for their assigned positions"
  ON public.covered_calls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assigned_positions
      WHERE assigned_positions.id = covered_calls.assigned_position_id
        AND assigned_positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete covered calls for their assigned positions"
  ON public.covered_calls FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.assigned_positions
      WHERE assigned_positions.id = covered_calls.assigned_position_id
        AND assigned_positions.user_id = auth.uid()
    )
  );

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_assigned_positions_updated_at
  BEFORE UPDATE ON public.assigned_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_covered_calls_updated_at
  BEFORE UPDATE ON public.covered_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_assigned_positions_user_id ON public.assigned_positions(user_id);
CREATE INDEX idx_assigned_positions_symbol ON public.assigned_positions(symbol);
CREATE INDEX idx_assigned_positions_is_active ON public.assigned_positions(is_active);
CREATE INDEX idx_covered_calls_assigned_position_id ON public.covered_calls(assigned_position_id);
CREATE INDEX idx_covered_calls_is_active ON public.covered_calls(is_active);