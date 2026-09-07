-- Tighten invite RPC execution and bind dashboard-share acceptance to the
-- authenticated user. This is additive and does not touch financial rows.

REVOKE ALL ON FUNCTION public.get_share_by_invite_token(TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_share_by_invite_token(TEXT)
  TO authenticated;

REVOKE ALL ON FUNCTION public.cleanup_old_invite_attempts()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_invite_rate_limit(INET, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_invite_rate_limit(INET, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.accept_dashboard_invite(
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
  v_share RECORD;
  v_authenticated_email TEXT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT email INTO v_authenticated_email
  FROM auth.users
  WHERE id = auth.uid();

  IF lower(trim(COALESCE(v_authenticated_email, ''))) IS DISTINCT FROM lower(trim(COALESCE(p_user_email, ''))) THEN
    RETURN json_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  SELECT * INTO v_share
  FROM public.position_shares
  WHERE invite_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found');
  END IF;

  IF v_share.accepted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invite already accepted');
  END IF;

  IF v_share.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  IF lower(trim(v_share.shared_with_email)) IS DISTINCT FROM lower(trim(v_authenticated_email)) THEN
    RETURN json_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  UPDATE public.position_shares
  SET shared_with_user_id = auth.uid(),
      accepted_at = now()
  WHERE id = v_share.id
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invite already accepted');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_dashboard_invite(TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_dashboard_invite(TEXT, UUID, TEXT)
  TO authenticated;
