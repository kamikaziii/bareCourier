-- Create atomic function to replace pricing zones
-- This ensures DELETE and INSERT happen in a single transaction
-- Prevents data loss if insert fails after delete

CREATE OR REPLACE FUNCTION replace_pricing_zones(
    p_client_id uuid,
    p_zones jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION replace_pricing_zones(uuid, jsonb) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION replace_pricing_zones IS
    'Atomically replaces all pricing zones for a client. DELETE + INSERT in single transaction.';
