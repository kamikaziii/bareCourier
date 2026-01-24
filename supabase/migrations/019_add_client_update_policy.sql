-- Allow clients to update their own services when:
-- 1. Responding to courier suggestions (request_status = 'suggested')
-- 2. Cancelling pending requests (request_status = 'pending')
--
-- This policy enables both #027 (suggestion response) AND #015 (cancellation)
-- Multiple permissive policies use OR logic in Supabase RLS

CREATE POLICY "clients_can_update_own_services"
ON services FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
  AND request_status IN ('pending', 'suggested')
)
WITH CHECK (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
);

-- Add comment for documentation
COMMENT ON POLICY "clients_can_update_own_services" ON services IS
  'Allows clients to: 1) Accept/decline courier suggestions, 2) Cancel pending requests (soft delete)';
