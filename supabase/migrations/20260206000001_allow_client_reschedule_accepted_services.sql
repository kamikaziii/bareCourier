-- Allow clients to update services with request_status = 'accepted' too.
-- This is needed so clients can request reschedules on services that have
-- been accepted by the courier (pending_reschedule_* fields).
-- The trigger check_client_service_update_fields() already restricts which
-- fields clients can modify on non-pending services.

DROP POLICY IF EXISTS "clients_can_update_own_services" ON services;

CREATE POLICY "clients_can_update_own_services"
ON services FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
  AND request_status IN ('pending', 'suggested', 'accepted')
)
WITH CHECK (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
);

COMMENT ON POLICY "clients_can_update_own_services" ON services IS
  'Allows clients to: 1) Accept/decline courier suggestions, 2) Cancel pending requests, 3) Request reschedules on accepted services';
