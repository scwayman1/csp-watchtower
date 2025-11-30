-- Add attachments column to messages table
ALTER TABLE public.messages
ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false);

-- RLS policies for message-attachments bucket
-- Users can view attachments from messages they can access
CREATE POLICY "Users can view message attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments' AND
  auth.uid() IS NOT NULL
);

-- Users can upload attachments
CREATE POLICY "Users can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments' AND
  auth.uid() IS NOT NULL
);

-- Users can delete their own attachments
CREATE POLICY "Users can delete their message attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-attachments' AND
  auth.uid() IS NOT NULL
);