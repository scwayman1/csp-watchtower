-- Create table for simulator portfolio history snapshots
CREATE TABLE public.simulator_portfolio_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  cash_balance NUMERIC NOT NULL,
  positions_value NUMERIC NOT NULL,
  assigned_shares_value NUMERIC NOT NULL,
  total_premiums_collected NUMERIC NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL, -- 'position_opened', 'position_closed', 'position_assigned', 'covered_call_sold', 'manual_snapshot'
  event_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.simulator_portfolio_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own portfolio history"
  ON public.simulator_portfolio_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio history"
  ON public.simulator_portfolio_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio history"
  ON public.simulator_portfolio_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient querying
CREATE INDEX idx_simulator_portfolio_history_user_date 
  ON public.simulator_portfolio_history(user_id, created_at DESC);