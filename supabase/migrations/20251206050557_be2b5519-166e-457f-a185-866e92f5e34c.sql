-- Drop existing policies on clients table
DROP POLICY IF EXISTS "Advisors can manage their clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own data" ON public.clients;

-- Recreate policies with explicit authentication requirement
CREATE POLICY "Advisors can manage their clients" 
ON public.clients 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND has_role(auth.uid(), 'advisor'::app_role) 
  AND advisor_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_role(auth.uid(), 'advisor'::app_role) 
  AND advisor_id = auth.uid()
);

CREATE POLICY "Clients can view their own data" 
ON public.clients 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Also fix ai_recommendations table policies to require authentication
DROP POLICY IF EXISTS "Service role can manage AI recommendations" ON public.ai_recommendations;
DROP POLICY IF EXISTS "Users can insert their own AI recommendations" ON public.ai_recommendations;
DROP POLICY IF EXISTS "Users can view their own AI recommendations" ON public.ai_recommendations;

-- Recreate with explicit auth checks (service role policy removed as it's too permissive)
CREATE POLICY "Users can insert their own AI recommendations" 
ON public.ai_recommendations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can view their own AI recommendations" 
ON public.ai_recommendations 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own AI recommendations" 
ON public.ai_recommendations 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);