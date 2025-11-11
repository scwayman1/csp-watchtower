-- Create positions table for cash-secured put tracking
CREATE TABLE public.positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  underlying_name text,
  strike_price numeric(12,4) NOT NULL,
  expiration date NOT NULL,
  contracts int NOT NULL DEFAULT 1,
  premium_per_contract numeric(12,4) NOT NULL,
  open_fees numeric(12,2) DEFAULT 0,
  broker text,
  raw_order_text text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on user_id and symbol for faster queries
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_positions_symbol ON public.positions(symbol);
CREATE INDEX idx_positions_expiration ON public.positions(expiration);
CREATE INDEX idx_positions_active ON public.positions(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for positions
CREATE POLICY "Users can view their own positions"
  ON public.positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own positions"
  ON public.positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own positions"
  ON public.positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own positions"
  ON public.positions FOR DELETE
  USING (auth.uid() = user_id);

-- Create market_data table for caching real-time prices
CREATE TABLE public.market_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL UNIQUE,
  underlying_price numeric(12,4),
  last_updated timestamptz DEFAULT now()
);

-- Create index on symbol for faster lookups
CREATE INDEX idx_market_data_symbol ON public.market_data(symbol);

-- Enable RLS (public read for all authenticated users)
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data"
  ON public.market_data FOR SELECT
  USING (true);

CREATE POLICY "Service role can update market data"
  ON public.market_data FOR ALL
  USING (true);

-- Create option_data table for option-specific metrics
CREATE TABLE public.option_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  mark_price numeric(12,4),
  bid_price numeric(12,4),
  ask_price numeric(12,4),
  delta numeric(6,4),
  implied_volatility numeric(6,4),
  last_updated timestamptz DEFAULT now()
);

-- Create index on position_id for faster lookups
CREATE INDEX idx_option_data_position_id ON public.option_data(position_id);

-- Enable RLS
ALTER TABLE public.option_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view option data for their positions"
  ON public.option_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.positions
      WHERE positions.id = option_data.position_id
      AND positions.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage option data"
  ON public.option_data FOR ALL
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();