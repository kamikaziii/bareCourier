-- Migration: Fix search_path inconsistency in SECURITY DEFINER functions
-- Two functions used `SET search_path = public` instead of the secure
-- `SET search_path = ''` pattern used by all other SECURITY DEFINER functions.
-- With search_path = '', all table references must be schema-qualified.

-- 1. update_service_types_updated_at() — no table references, just needs search_path fix
CREATE OR REPLACE FUNCTION update_service_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. replace_distribution_zones() — qualify distribution_zones with public.
CREATE OR REPLACE FUNCTION replace_distribution_zones(new_zones jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- SECURITY: Verify caller is courier
  IF NOT public.is_courier() THEN
    RAISE EXCEPTION 'Access denied: only courier can modify distribution zones';
  END IF;

  -- Delete all existing zones
  DELETE FROM public.distribution_zones WHERE true;

  -- Insert new zones if any
  IF jsonb_array_length(new_zones) > 0 THEN
    INSERT INTO public.distribution_zones (distrito, concelho)
    SELECT
      z->>'distrito',
      z->>'concelho'
    FROM jsonb_array_elements(new_zones) AS z;
  END IF;
END;
$$;

COMMENT ON FUNCTION replace_distribution_zones(jsonb) IS
  'Atomically replaces all distribution zones. Restricted to courier role.';
