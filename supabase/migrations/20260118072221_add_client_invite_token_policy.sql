-- Create a security definer function to validate client invite tokens
-- This bypasses RLS to allow invite validation before the user is authenticated

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.get_client_by_invite_token(text);

-- Create the function with security definer to bypass RLS
CREATE OR REPLACE FUNCTION public.get_client_by_invite_token(p_token text)
RETURNS TABLE (
  id uuid,
  advisor_id uuid,
  name text,
  email text,
  invite_status text,
  invite_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.advisor_id,
    c.name,
    c.email,
    c.invite_status,
    c.invite_token
  FROM public.clients c
  WHERE c.invite_token = p_token
  LIMIT 1;
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_client_by_invite_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_by_invite_token(text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_client_by_invite_token(text) IS
'Securely retrieves client information by invite token. Uses SECURITY DEFINER to bypass RLS,
allowing invite validation before the user is authenticated. Only returns limited client
information needed for the invite flow.';
