-- Add invitation tracking fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for faster invite token lookups
CREATE INDEX IF NOT EXISTS idx_clients_invite_token ON public.clients(invite_token);

-- Add constraint to ensure valid invite statuses
ALTER TABLE public.clients 
ADD CONSTRAINT check_invite_status 
CHECK (invite_status IN ('PENDING', 'ACCEPTED', 'EXPIRED'));

COMMENT ON COLUMN public.clients.invite_token IS 'Unique token for client invitation links';
COMMENT ON COLUMN public.clients.invite_status IS 'Status of the client invitation: PENDING, ACCEPTED, or EXPIRED';
COMMENT ON COLUMN public.clients.invited_at IS 'Timestamp when the invitation was sent';