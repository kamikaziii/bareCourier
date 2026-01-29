-- Atomic replacement of distribution zones
-- Fixes: Non-atomic delete/insert in saveDistributionZones action
-- The function runs in a single transaction, ensuring all-or-nothing behavior

CREATE OR REPLACE FUNCTION replace_distribution_zones(new_zones jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Grant execute to authenticated users (RLS on table still applies for direct access)
GRANT EXECUTE ON FUNCTION replace_distribution_zones(jsonb) TO authenticated;
