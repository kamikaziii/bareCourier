-- Fix HIGH: replace_pricing_zones has NO authentication check
-- Any user (even anonymous) could modify pricing zones for any client
-- Fix: Add courier role check at start of function
-- Note: Return type changed from void to jsonb

DROP FUNCTION IF EXISTS replace_pricing_zones(uuid, jsonb);

CREATE FUNCTION replace_pricing_zones(
  p_client_id uuid,
  p_zones jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
BEGIN
  -- SECURITY FIX: Add authentication check
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify user is courier (only courier should manage pricing)
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'courier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - courier role required');
  END IF;

  -- Delete existing zones for this client
  DELETE FROM public.pricing_zones WHERE client_id = p_client_id;

  -- Insert new zones if provided
  IF p_zones IS NOT NULL AND jsonb_array_length(p_zones) > 0 THEN
    INSERT INTO public.pricing_zones (client_id, min_km, max_km, price)
    SELECT
      p_client_id,
      (z->>'min_km')::numeric,
      NULLIF(z->>'max_km', '')::numeric,
      (z->>'price')::numeric
    FROM jsonb_array_elements(p_zones) AS z;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant to authenticated only (not anon)
GRANT EXECUTE ON FUNCTION replace_pricing_zones(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION replace_pricing_zones IS 'Replaces pricing zones for a client. Requires courier role.';
