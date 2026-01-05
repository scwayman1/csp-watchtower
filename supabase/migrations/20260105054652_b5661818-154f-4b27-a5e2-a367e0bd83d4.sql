
-- Create advisor_invites table for storing advisor invitation tokens
CREATE TABLE public.advisor_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  invite_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(invite_token),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.advisor_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all invites
CREATE POLICY "Admins can view all advisor invites"
ON public.advisor_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can create invites
CREATE POLICY "Admins can create advisor invites"
ON public.advisor_invites
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Admins can update invites
CREATE POLICY "Admins can update advisor invites"
ON public.advisor_invites
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Anyone can read their own invite by token (for the accept flow - handled by edge function with service role)

-- Create index on invite_token for fast lookups
CREATE INDEX idx_advisor_invites_token ON public.advisor_invites(invite_token);
CREATE INDEX idx_advisor_invites_email ON public.advisor_invites(email);
