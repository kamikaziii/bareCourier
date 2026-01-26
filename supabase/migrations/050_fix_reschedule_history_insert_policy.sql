-- Fix reschedule_history INSERT policy to verify service ownership
-- The previous policy only checked initiated_by = auth.uid() but did not verify
-- that the user has access to the service_id being referenced.
--
-- TODO #104: Reschedule History Insert Policy Missing Service Ownership Check

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS reschedule_history_insert ON service_reschedule_history;

-- Create new INSERT policy with service ownership check
-- User must match initiated_by AND (be courier OR own the service via client_id)
CREATE POLICY reschedule_history_insert ON service_reschedule_history
  FOR INSERT WITH CHECK (
    initiated_by = (SELECT auth.uid())
    AND (
      -- Courier can insert for any service
      EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'courier')
      OR
      -- Client can only insert for their own services
      EXISTS (
        SELECT 1 FROM services s
        WHERE s.id = service_reschedule_history.service_id
        AND s.client_id = (SELECT auth.uid())
      )
    )
  );
