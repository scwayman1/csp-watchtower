-- Make advisor invite acceptance a single, authenticated transaction.
CREATE OR REPLACE FUNCTION public.complete_advisor_signup(
  p_invite_id UUID,
  p_token TEXT,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.advisor_invites%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Account not found');
  END IF;

  SELECT * INTO v_invite
  FROM public.advisor_invites
  WHERE id = p_invite_id
    AND invite_token = p_token
  FOR UPDATE;

  IF NOT FOUND OR v_invite.status <> 'PENDING' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or already used invitation');
  END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.advisor_invites
    SET status = 'EXPIRED'
    WHERE id = v_invite.id AND status = 'PENDING';
    RETURN json_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF lower(trim(v_invite.email)) IS DISTINCT FROM lower(trim(p_user_email)) THEN
    RETURN json_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'advisor')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.advisor_invites
  SET status = 'ACCEPTED', user_id = p_user_id, accepted_at = now()
  WHERE id = v_invite.id AND status = 'PENDING';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invitation was accepted concurrently');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_advisor_signup(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_advisor_signup(UUID, TEXT, UUID, TEXT) TO service_role;
