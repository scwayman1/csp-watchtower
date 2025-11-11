-- Drop the overly permissive policy that exposes all emails
DROP POLICY IF EXISTS "Anyone can view shares by invite token" ON public.position_shares;

-- Create a security definer function to safely look up shares by token
-- This prevents email harvesting by only returning the exact match
CREATE OR REPLACE FUNCTION public.get_share_by_invite_token(token_input TEXT)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  shared_with_email TEXT,
  shared_with_user_id UUID,
  invite_token TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.owner_id,
    ps.shared_with_email,
    ps.shared_with_user_id,
    ps.invite_token,
    ps.accepted_at,
    ps.created_at
  FROM public.position_shares ps
  WHERE ps.invite_token = token_input
  LIMIT 1;
END;
$$;