-- Add primary_client_id to threads for convenience
ALTER TABLE public.threads 
ADD COLUMN IF NOT EXISTS primary_client_id uuid REFERENCES public.clients(id);

-- Add channel-related fields to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'sms', 'system')),
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound', 'system')),
ADD COLUMN IF NOT EXISTS provider_message_id text,
ADD COLUMN IF NOT EXISTS meta jsonb;

-- Add sms_opt_in to clients table for SMS consent tracking
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS sms_opt_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS phone_number text;

-- Create index for efficient channel-based queries
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON public.messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_threads_primary_client_id ON public.threads(primary_client_id);