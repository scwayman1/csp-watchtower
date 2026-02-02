-- Create RPC function to get client by invite token (bypasses RLS for validation)
CREATE OR REPLACE FUNCTION public.get_client_by_invite_token(p_token text)
RETURNS TABLE (
  id uuid,
  advisor_id uuid,
  name text,
  email text,
  invite_status text,
  invite_token text
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.advisor_id,
    c.name,
    c.email,
    c.invite_status,
    c.invite_token
  FROM clients c
  WHERE c.invite_token = p_token
  LIMIT 1;
$$;