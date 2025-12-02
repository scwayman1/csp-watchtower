-- Update covered_calls RLS policies to support household members

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert covered calls for their assigned positions" ON covered_calls;
DROP POLICY IF EXISTS "Users can view covered calls for their assigned positions" ON covered_calls;
DROP POLICY IF EXISTS "Users can update covered calls for their assigned positions" ON covered_calls;
DROP POLICY IF EXISTS "Users can delete covered calls for their assigned positions" ON covered_calls;

-- Recreate with household member support
CREATE POLICY "Users can insert covered calls for their assigned positions"
ON covered_calls FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM assigned_positions
    WHERE assigned_positions.id = covered_calls.assigned_position_id
    AND (
      assigned_positions.user_id = auth.uid()
      OR is_household_member(auth.uid(), assigned_positions.user_id)
    )
  )
);

CREATE POLICY "Users can view covered calls for their assigned positions"
ON covered_calls FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM assigned_positions
    WHERE assigned_positions.id = covered_calls.assigned_position_id
    AND (
      assigned_positions.user_id = auth.uid()
      OR is_household_member(auth.uid(), assigned_positions.user_id)
    )
  )
);

CREATE POLICY "Users can update covered calls for their assigned positions"
ON covered_calls FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM assigned_positions
    WHERE assigned_positions.id = covered_calls.assigned_position_id
    AND (
      assigned_positions.user_id = auth.uid()
      OR is_household_member(auth.uid(), assigned_positions.user_id)
    )
  )
);

CREATE POLICY "Users can delete covered calls for their assigned positions"
ON covered_calls FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM assigned_positions
    WHERE assigned_positions.id = covered_calls.assigned_position_id
    AND (
      assigned_positions.user_id = auth.uid()
      OR is_household_member(auth.uid(), assigned_positions.user_id)
    )
  )
);