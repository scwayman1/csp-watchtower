-- Create learning_assigned_positions table for tracking assigned stocks in simulator
CREATE TABLE public.learning_assigned_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  shares INTEGER NOT NULL,
  assignment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  assignment_price NUMERIC NOT NULL,
  cost_basis NUMERIC NOT NULL,
  original_learning_position_id UUID,
  original_put_premium NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sold_price NUMERIC,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_covered_calls table for tracking covered calls in simulator
CREATE TABLE public.learning_covered_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_assigned_position_id UUID NOT NULL REFERENCES public.learning_assigned_positions(id) ON DELETE CASCADE,
  strike_price NUMERIC NOT NULL,
  expiration TEXT NOT NULL,
  premium_per_contract NUMERIC NOT NULL,
  contracts INTEGER NOT NULL DEFAULT 1,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create simulator_settings table for tracking starting capital
CREATE TABLE public.simulator_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  starting_capital NUMERIC NOT NULL DEFAULT 100000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.learning_assigned_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_covered_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for learning_assigned_positions
CREATE POLICY "Users can view their own learning assigned positions"
  ON public.learning_assigned_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own learning assigned positions"
  ON public.learning_assigned_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning assigned positions"
  ON public.learning_assigned_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning assigned positions"
  ON public.learning_assigned_positions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for learning_covered_calls
CREATE POLICY "Users can view their own learning covered calls"
  ON public.learning_covered_calls FOR SELECT
  USING (
    learning_assigned_position_id IN (
      SELECT id FROM public.learning_assigned_positions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own learning covered calls"
  ON public.learning_covered_calls FOR INSERT
  WITH CHECK (
    learning_assigned_position_id IN (
      SELECT id FROM public.learning_assigned_positions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own learning covered calls"
  ON public.learning_covered_calls FOR UPDATE
  USING (
    learning_assigned_position_id IN (
      SELECT id FROM public.learning_assigned_positions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own learning covered calls"
  ON public.learning_covered_calls FOR DELETE
  USING (
    learning_assigned_position_id IN (
      SELECT id FROM public.learning_assigned_positions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for simulator_settings
CREATE POLICY "Users can view their own simulator settings"
  ON public.simulator_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulator settings"
  ON public.simulator_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own simulator settings"
  ON public.simulator_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_learning_assigned_positions_updated_at
  BEFORE UPDATE ON public.learning_assigned_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_covered_calls_updated_at
  BEFORE UPDATE ON public.learning_covered_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_simulator_settings_updated_at
  BEFORE UPDATE ON public.simulator_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_learning_assigned_positions_user_id ON public.learning_assigned_positions(user_id);
CREATE INDEX idx_learning_assigned_positions_is_active ON public.learning_assigned_positions(is_active);
CREATE INDEX idx_learning_covered_calls_assigned_position_id ON public.learning_covered_calls(learning_assigned_position_id);
CREATE INDEX idx_learning_covered_calls_is_active ON public.learning_covered_calls(is_active);
CREATE INDEX idx_simulator_settings_user_id ON public.simulator_settings(user_id);