-- Defense-in-depth: explicitly revoke anon execution from RPC functions
-- created after the original REVOKE migration (20260121000043).
-- These functions already have internal auth.uid() checks, but explicit
-- REVOKE prevents anon from even calling them, adding a second layer.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION bulk_reschedule_services(uuid[], date, text, time, text, uuid) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END; $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION client_approve_reschedule(uuid) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END; $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION client_deny_reschedule(uuid, text) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END; $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION replace_distribution_zones(jsonb) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL;
END; $$;
