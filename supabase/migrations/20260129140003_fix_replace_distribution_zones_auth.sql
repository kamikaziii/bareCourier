-- Migration: Fix replace_distribution_zones authorization
-- SECURITY FIX: Add courier role check inside the function
-- The original function used SECURITY DEFINER which bypasses RLS,
-- but was callable by any authenticated user including clients.

CREATE OR REPLACE FUNCTION replace_distribution_zones(new_zones jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller is courier
  IF NOT public.is_courier() THEN
    RAISE EXCEPTION 'Access denied: only courier can modify distribution zones';
  END IF;

  -- Delete all existing zones
  DELETE FROM distribution_zones WHERE true;

  -- Insert new zones if any
  IF jsonb_array_length(new_zones) > 0 THEN
    INSERT INTO distribution_zones (distrito, concelho)
    SELECT
      z->>'distrito',
      z->>'concelho'
    FROM jsonb_array_elements(new_zones) AS z;
  END IF;
END;
$$;

COMMENT ON FUNCTION replace_distribution_zones(jsonb) IS
  'Atomically replaces all distribution zones. Restricted to courier role.';
