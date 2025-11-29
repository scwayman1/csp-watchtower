-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('investor', 'advisor', 'admin');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  segment TEXT CHECK (segment IN ('Aggressive', 'Income', 'Conservative', 'Other')),
  portfolio_value NUMERIC DEFAULT 0,
  available_cash NUMERIC DEFAULT 0,
  premium_ytd NUMERIC DEFAULT 0,
  open_csp_count INTEGER DEFAULT 0,
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can manage their clients"
  ON public.clients FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid()
  );

CREATE POLICY "Clients can view their own data"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create cycles table
CREATE TABLE public.cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  status TEXT CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')) DEFAULT 'DRAFT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can manage their cycles"
  ON public.cycles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid());

-- Create model_trades table
CREATE TABLE public.model_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL,
  strategy TEXT CHECK (strategy IN ('CSP', 'COVERED_CALL')) NOT NULL,
  underlying TEXT NOT NULL,
  strike NUMERIC NOT NULL,
  expiration DATE NOT NULL,
  target_premium NUMERIC NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  notes TEXT,
  source TEXT DEFAULT 'ADVISOR_ALLOCATION',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.model_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can manage their model trades"
  ON public.model_trades FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid());

-- Create allocations table
CREATE TABLE public.allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_trade_id UUID NOT NULL REFERENCES public.model_trades(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL,
  contracts INTEGER NOT NULL,
  estimated_premium_total NUMERIC NOT NULL,
  source TEXT DEFAULT 'ADVISOR_ALLOCATION',
  status TEXT CHECK (status IN ('DRAFT', 'PENDING', 'EXECUTED', 'FAILED')) DEFAULT 'DRAFT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors can manage their allocations"
  ON public.allocations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'advisor') AND advisor_id = auth.uid());

-- Add source column to existing positions table
ALTER TABLE public.positions 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'INVESTOR_MANUAL',
ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES public.allocations(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_clients_advisor ON public.clients(advisor_id);
CREATE INDEX idx_clients_user ON public.clients(user_id);
CREATE INDEX idx_cycles_advisor ON public.cycles(advisor_id);
CREATE INDEX idx_model_trades_cycle ON public.model_trades(cycle_id);
CREATE INDEX idx_model_trades_advisor ON public.model_trades(advisor_id);
CREATE INDEX idx_allocations_model_trade ON public.allocations(model_trade_id);
CREATE INDEX idx_allocations_client ON public.allocations(client_id);
CREATE INDEX idx_allocations_advisor ON public.allocations(advisor_id);
CREATE INDEX idx_positions_source ON public.positions(source);
CREATE INDEX idx_positions_allocation ON public.positions(allocation_id);

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cycles_updated_at
  BEFORE UPDATE ON public.cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_model_trades_updated_at
  BEFORE UPDATE ON public.model_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at
  BEFORE UPDATE ON public.allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();