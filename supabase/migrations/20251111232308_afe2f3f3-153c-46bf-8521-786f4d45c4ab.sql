-- Add invite token to position_shares table
ALTER TABLE public.position_shares
ADD COLUMN invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::text NOT NULL;

-- Add accepted_at timestamp to track when invite was used
ALTER TABLE public.position_shares
ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX idx_position_shares_invite_token ON public.position_shares(invite_token);

-- Create RLS policy to allow anyone to read shares by token (needed for invite acceptance)
CREATE POLICY "Anyone can view shares by invite token"
ON public.position_shares
FOR SELECT
TO authenticated
USING (invite_token IS NOT NULL);