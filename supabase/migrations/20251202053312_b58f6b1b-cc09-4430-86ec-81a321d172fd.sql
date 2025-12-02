-- Add RLS policy to allow advisors to view client positions
CREATE POLICY "Advisors can view client positions"
ON positions
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND user_id IN (
    SELECT user_id 
    FROM clients 
    WHERE advisor_id = auth.uid() 
    AND invite_status = 'ACCEPTED'
    AND user_id IS NOT NULL
  )
);

-- Add RLS policy to allow advisors to view client assigned positions
CREATE POLICY "Advisors can view client assigned positions"
ON assigned_positions
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role) 
  AND user_id IN (
    SELECT user_id 
    FROM clients 
    WHERE advisor_id = auth.uid() 
    AND invite_status = 'ACCEPTED'
    AND user_id IS NOT NULL
  )
);

-- Add RLS policy to allow advisors to view client covered calls
CREATE POLICY "Advisors can view client covered calls"
ON covered_calls
FOR SELECT
USING (
  has_role(auth.uid(), 'advisor'::app_role)
  AND assigned_position_id IN (
    SELECT ap.id
    FROM assigned_positions ap
    INNER JOIN clients c ON c.user_id = ap.user_id
    WHERE c.advisor_id = auth.uid()
    AND c.invite_status = 'ACCEPTED'
    AND c.user_id IS NOT NULL
  )
);