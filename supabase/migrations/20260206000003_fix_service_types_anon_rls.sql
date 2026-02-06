-- Migration: Fix service_types_select_client RLS policy to require authentication
-- Audit finding #280: The policy allowed anonymous access because it had no auth check.
-- Now requires auth.uid() IS NOT NULL so only authenticated users can read active service types.

DROP POLICY IF EXISTS "service_types_select_client" ON service_types;

CREATE POLICY "service_types_select_client" ON service_types
  FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);
