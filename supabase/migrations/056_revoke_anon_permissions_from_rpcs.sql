-- Fix HIGH: Revoke anon permissions from all RPC functions
-- Even functions with internal auth checks should not be callable by anonymous users
-- Defense in depth - multiple layers of security

-- Revoke anon from approve_reschedule
REVOKE EXECUTE ON FUNCTION approve_reschedule(uuid, uuid) FROM anon;

-- Revoke anon from deny_reschedule
REVOKE EXECUTE ON FUNCTION deny_reschedule(uuid, uuid, text) FROM anon;

-- Revoke anon from calculate_service_price
REVOKE EXECUTE ON FUNCTION calculate_service_price(uuid, numeric, uuid) FROM anon;

-- Revoke anon from replace_pricing_zones
REVOKE EXECUTE ON FUNCTION replace_pricing_zones(uuid, jsonb) FROM anon;

-- Revoke anon from reschedule_service (if exists)
DO $$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION reschedule_service FROM anon';
EXCEPTION
  WHEN undefined_function THEN
    NULL; -- Function doesn't exist, ignore
END;
$$;
