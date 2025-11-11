-- Create position_shares table to track dashboard sharing
CREATE TABLE public.position_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(owner_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE public.position_shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Users can manage their own shares"
ON public.position_shares
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Shared users can see shares granted to them
CREATE POLICY "Users can view shares granted to them"
ON public.position_shares
FOR SELECT
USING (auth.uid() = shared_with_user_id);

-- Update positions RLS to allow shared access
DROP POLICY IF EXISTS "Users can view their own positions" ON public.positions;

CREATE POLICY "Users can view their own or shared positions"
ON public.positions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM public.position_shares
    WHERE position_shares.owner_id = positions.user_id
    AND position_shares.shared_with_user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_position_shares_shared_with ON public.position_shares(shared_with_user_id);
CREATE INDEX idx_position_shares_owner ON public.position_shares(owner_id);