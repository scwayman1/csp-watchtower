-- Create portfolio history table for real portfolio tracking
CREATE TABLE IF NOT EXISTS public.portfolio_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  cash_balance NUMERIC NOT NULL,
  positions_value NUMERIC NOT NULL,
  assigned_shares_value NUMERIC NOT NULL,
  total_premiums_collected NUMERIC NOT NULL DEFAULT 0,
  net_position_pnl NUMERIC NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  event_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own portfolio history"
  ON public.portfolio_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio history"
  ON public.portfolio_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio history"
  ON public.portfolio_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_portfolio_history_user_id ON public.portfolio_history(user_id);
CREATE INDEX idx_portfolio_history_created_at ON public.portfolio_history(created_at DESC);