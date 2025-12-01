-- Create household members table for joint accounts
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  relationship text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(primary_user_id, member_user_id),
  CHECK (primary_user_id != member_user_id)
);

-- Enable RLS
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for household_members
CREATE POLICY "Users can view their household"
ON public.household_members
FOR SELECT
USING (
  auth.uid() = primary_user_id OR 
  auth.uid() = member_user_id
);

CREATE POLICY "Primary users can manage household"
ON public.household_members
FOR ALL
USING (auth.uid() = primary_user_id)
WITH CHECK (auth.uid() = primary_user_id);

-- Security definer function to check household membership
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE (primary_user_id = _target_user_id AND member_user_id = _user_id)
       OR (primary_user_id = _user_id AND member_user_id = _target_user_id)
       OR (_user_id = _target_user_id)
  )
$$;

-- Update RLS policies on positions to include household members
DROP POLICY IF EXISTS "Users can view their own or shared positions" ON public.positions;
CREATE POLICY "Users can view their own or shared positions"
ON public.positions
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id) OR
  EXISTS (
    SELECT 1 FROM position_shares
    WHERE position_shares.owner_id = positions.user_id 
    AND position_shares.shared_with_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert their own positions" ON public.positions;
CREATE POLICY "Users can insert their own positions"
ON public.positions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can update their own positions" ON public.positions;
CREATE POLICY "Users can update their own positions"
ON public.positions
FOR UPDATE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can delete their own positions" ON public.positions;
CREATE POLICY "Users can delete their own positions"
ON public.positions
FOR DELETE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

-- Update RLS policies on assigned_positions
DROP POLICY IF EXISTS "Users can view their own assigned positions" ON public.assigned_positions;
CREATE POLICY "Users can view their own assigned positions"
ON public.assigned_positions
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can insert their own assigned positions" ON public.assigned_positions;
CREATE POLICY "Users can insert their own assigned positions"
ON public.assigned_positions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can update their own assigned positions" ON public.assigned_positions;
CREATE POLICY "Users can update their own assigned positions"
ON public.assigned_positions
FOR UPDATE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can delete their own assigned positions" ON public.assigned_positions;
CREATE POLICY "Users can delete their own assigned positions"
ON public.assigned_positions
FOR DELETE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

-- Update RLS policies on portfolio_history
DROP POLICY IF EXISTS "Users can view their own portfolio history" ON public.portfolio_history;
CREATE POLICY "Users can view their own portfolio history"
ON public.portfolio_history
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can insert their own portfolio history" ON public.portfolio_history;
CREATE POLICY "Users can insert their own portfolio history"
ON public.portfolio_history
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can delete their own portfolio history" ON public.portfolio_history;
CREATE POLICY "Users can delete their own portfolio history"
ON public.portfolio_history
FOR DELETE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

-- Update RLS policies on user_settings
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  public.is_household_member(auth.uid(), user_id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_household_members_updated_at
BEFORE UPDATE ON public.household_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_household_members_primary ON public.household_members(primary_user_id);
CREATE INDEX idx_household_members_member ON public.household_members(member_user_id);