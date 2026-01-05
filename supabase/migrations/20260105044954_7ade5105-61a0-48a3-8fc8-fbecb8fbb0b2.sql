-- Allow advisors to view their clients' learning positions
CREATE POLICY "Advisors can view client learning positions"
ON public.learning_positions
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND user_id IN (
    SELECT c.user_id FROM clients c 
    WHERE c.advisor_id = auth.uid() 
    AND c.invite_status = 'ACCEPTED' 
    AND c.user_id IS NOT NULL
  )
);

-- Allow advisors to view their clients' learning assigned positions
CREATE POLICY "Advisors can view client learning assigned positions"
ON public.learning_assigned_positions
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND user_id IN (
    SELECT c.user_id FROM clients c 
    WHERE c.advisor_id = auth.uid() 
    AND c.invite_status = 'ACCEPTED' 
    AND c.user_id IS NOT NULL
  )
);

-- Allow advisors to view their clients' learning covered calls
CREATE POLICY "Advisors can view client learning covered calls"
ON public.learning_covered_calls
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND learning_assigned_position_id IN (
    SELECT lap.id 
    FROM learning_assigned_positions lap
    JOIN clients c ON c.user_id = lap.user_id
    WHERE c.advisor_id = auth.uid() 
    AND c.invite_status = 'ACCEPTED' 
    AND c.user_id IS NOT NULL
  )
);

-- Allow advisors to view their clients' simulator settings
CREATE POLICY "Advisors can view client simulator settings"
ON public.simulator_settings
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND user_id IN (
    SELECT c.user_id FROM clients c 
    WHERE c.advisor_id = auth.uid() 
    AND c.invite_status = 'ACCEPTED' 
    AND c.user_id IS NOT NULL
  )
);