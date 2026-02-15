-- =============================================================================
-- Migration: Harden Invite Flow
-- Date: 2026-02-15
-- Description: Add expiration, rate limiting, and server-side email validation
--              to all invite acceptance paths.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add expires_at to advisor_invites
-- ---------------------------------------------------------------------------
ALTER TABLE public.advisor_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    DEFAULT (now() + interval '48 hours');

-- Backfill existing pending invites with 48h from creation
UPDATE public.advisor_invites
SET expires_at = created_at + interval '48 hours'
WHERE expires_at IS NULL;

-- Make NOT NULL going forward
ALTER TABLE public.advisor_invites
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advisor_invites_expires
  ON public.advisor_invites(expires_at)
  WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- 2. Add expires_at to position_shares
-- ---------------------------------------------------------------------------
ALTER TABLE public.position_shares
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE
    DEFAULT (now() + interval '48 hours');

-- Backfill existing unaccepted shares
UPDATE public.position_shares
SET expires_at = created_at + interval '48 hours'
WHERE expires_at IS NULL AND accepted_at IS NULL;

-- For already-accepted shares, set a far-future expiry (they don't need it)
UPDATE public.position_shares
SET expires_at = '2099-12-31T23:59:59Z'
WHERE expires_at IS NULL AND accepted_at IS NOT NULL;

ALTER TABLE public.position_shares
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_position_shares_expires
  ON public.position_shares(expires_at)
  WHERE accepted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Add expires_at to clients table (for client invite tokens)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE
    DEFAULT (now() + interval '48 hours');

-- Backfill
UPDATE public.clients
SET invite_expires_at = created_at + interval '48 hours'
WHERE invite_expires_at IS NULL AND invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_invite_expires
  ON public.clients(invite_expires_at)
  WHERE invite_token IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Rate limiting table for invite acceptance attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invite_acceptance_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET,
  token_hash TEXT NOT NULL, -- SHA-256 of the attempted token (don't store raw tokens)
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false
);

-- Index for rate limit lookups (by IP in last hour)
CREATE INDEX IF NOT EXISTS idx_invite_attempts_ip_time
  ON public.invite_acceptance_attempts(ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_token_time
  ON public.invite_acceptance_attempts(token_hash, attempted_at DESC);

-- RLS: only service role can access this table
ALTER TABLE public.invite_acceptance_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = no access except service_role

-- Auto-cleanup old attempts (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_invite_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.invite_acceptance_attempts
  WHERE attempted_at < now() - interval '24 hours';
$$;

-- ---------------------------------------------------------------------------
-- 5. Server-side accept_dashboard_invite RPC (replaces client-side update)
-- ---------------------------------------------------------------------------
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
  v_result JSON;
BEGIN
  -- Look up the share
  SELECT * INTO v_share
  FROM public.position_shares
  WHERE invite_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found');
  END IF;

  -- Check already accepted
  IF v_share.accepted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invite already accepted');
  END IF;

  -- Check expiration
  IF v_share.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Invite has expired');
  END IF;

  -- SERVER-SIDE email match enforcement
  IF v_share.shared_with_email IS DISTINCT FROM p_user_email THEN
    RETURN json_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  -- Accept the invite
  UPDATE public.position_shares
  SET shared_with_user_id = p_user_id,
      accepted_at = now()
  WHERE id = v_share.id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_dashboard_invite(TEXT, UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Update get_share_by_invite_token to include expires_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_share_by_invite_token(token_input TEXT)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  shared_with_email TEXT,
  shared_with_user_id UUID,
  invite_token TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
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
    ps.created_at,
    ps.expires_at
  FROM public.position_shares ps
  WHERE ps.invite_token = token_input
  LIMIT 1;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Update get_client_by_invite_token to include expiration
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_client_by_invite_token(text);

CREATE OR REPLACE FUNCTION public.get_client_by_invite_token(p_token text)
RETURNS TABLE (
  id UUID,
  advisor_id UUID,
  name TEXT,
  email TEXT,
  invite_token TEXT,
  invite_status TEXT,
  invite_expires_at TIMESTAMP WITH TIME ZONE
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
    c.invite_token,
    c.invite_status,
    c.invite_expires_at
  FROM public.clients c
  WHERE c.invite_token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_by_invite_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_by_invite_token(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Function to check rate limits (for use in edge functions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_invite_rate_limit(
  p_ip_address INET,
  p_token_hash TEXT,
  p_max_attempts_per_ip INTEGER DEFAULT 10,
  p_max_attempts_per_token INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_count INTEGER;
  v_token_count INTEGER;
  v_window TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window := now() - (p_window_minutes || ' minutes')::interval;

  -- Count attempts by IP
  SELECT COUNT(*) INTO v_ip_count
  FROM public.invite_acceptance_attempts
  WHERE ip_address = p_ip_address
    AND attempted_at > v_window;

  -- Count attempts by token hash
  SELECT COUNT(*) INTO v_token_count
  FROM public.invite_acceptance_attempts
  WHERE token_hash = p_token_hash
    AND attempted_at > v_window;

  IF v_ip_count >= p_max_attempts_per_ip THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many attempts from this IP');
  END IF;

  IF v_token_count >= p_max_attempts_per_token THEN
    RETURN json_build_object('allowed', false, 'reason', 'Too many attempts for this token');
  END IF;

  -- Log the attempt
  INSERT INTO public.invite_acceptance_attempts (ip_address, token_hash)
  VALUES (p_ip_address, p_token_hash);

  -- Opportunistic cleanup
  PERFORM public.cleanup_old_invite_attempts();

  RETURN json_build_object('allowed', true);
END;
$$;
