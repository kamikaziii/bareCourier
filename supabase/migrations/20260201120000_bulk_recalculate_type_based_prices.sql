-- Create RPC function for bulk type-based price recalculation
-- Used by recalculateMissing and recalculateAll actions in client billing tab
-- Follows the pattern from bulk_recalculate_service_prices but for type-based pricing mode
-- Requires courier role for authorization

CREATE OR REPLACE FUNCTION bulk_recalculate_type_based_prices(
    p_service_ids uuid[],
    p_client_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    -- Use explicit variables instead of record to avoid ROW() issues
    v_time_specific_price numeric;
    v_out_of_zone_base numeric;
    v_out_of_zone_per_km numeric;
    v_service_types jsonb;
    v_service record;
    v_service_type_price numeric;
    v_base_price numeric;
    v_distance_component numeric;
    v_final_price numeric;
    v_breakdown jsonb;
    v_reason text;
    v_updated_count integer := 0;
    v_skipped_count integer := 0;
BEGIN
    -- Authorization check: only couriers can recalculate prices
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not authenticated',
            'updated', 0,
            'skipped', 0
        );
    END IF;

    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_role IS NULL OR v_user_role != 'courier' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized - courier role required',
            'updated', 0,
            'skipped', 0
        );
    END IF;

    -- Fetch courier settings for type-based pricing once (use explicit variables)
    SELECT
        COALESCE(time_specific_price, 0),
        COALESCE(out_of_zone_base, 0),
        COALESCE(out_of_zone_per_km, 0)
    INTO v_time_specific_price, v_out_of_zone_base, v_out_of_zone_per_km
    FROM public.profiles
    WHERE role = 'courier'
    LIMIT 1;

    -- Fetch all active service types as a lookup map
    SELECT COALESCE(jsonb_object_agg(
        st.id::text,
        jsonb_build_object(
            'name', st.name,
            'price', st.price
        )
    ), '{}'::jsonb)
    INTO v_service_types
    FROM public.service_types st
    WHERE st.active = true;

    -- Process each service
    FOR v_service IN
        SELECT
            s.id,
            s.service_type_id,
            s.is_out_of_zone,
            s.has_time_preference,
            s.distance_km,
            s.tolls
        FROM public.services s
        WHERE s.id = ANY(p_service_ids)
          AND s.service_type_id IS NOT NULL
    LOOP
        -- Skip if service type is not found in active types
        IF NOT v_service_types ? v_service.service_type_id::text THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Get the base service type price
        v_service_type_price := (v_service_types->v_service.service_type_id::text->>'price')::numeric;

        -- Calculate price based on priority:
        -- 1. Out-of-zone: base + (distance × per_km) + tolls
        -- 2. Time preference: time_specific_price (only if > 0)
        -- 3. Normal: service_type.price

        IF v_service.is_out_of_zone = true THEN
            -- Out-of-zone pricing
            v_base_price := v_out_of_zone_base;
            v_distance_component := COALESCE(v_service.distance_km, 0) * v_out_of_zone_per_km;
            v_final_price := v_base_price + v_distance_component + COALESCE(v_service.tolls, 0);
            v_reason := 'out_of_zone';

        ELSIF v_service.has_time_preference = true AND v_time_specific_price > 0 THEN
            -- Time preference pricing (only if price is configured > 0)
            v_base_price := v_time_specific_price;
            v_distance_component := 0;
            v_final_price := v_base_price;
            v_reason := 'time_preference';

        ELSE
            -- Normal service type pricing
            v_base_price := v_service_type_price;
            v_distance_component := 0;
            v_final_price := v_base_price;
            v_reason := 'service_type';
        END IF;

        -- Round to 2 decimal places
        v_final_price := ROUND(v_final_price, 2);

        -- Build breakdown with correct base value for each reason
        v_breakdown := jsonb_build_object(
            'base', v_base_price,
            'distance', v_distance_component,
            'urgency', 0,
            'tolls', COALESCE(v_service.tolls, 0),
            'total', v_final_price,
            'model', 'type',
            'distance_km', COALESCE(v_service.distance_km, 0),
            'reason', v_reason,
            'service_type_name', v_service_types->v_service.service_type_id::text->>'name'
        );

        -- Update the service
        UPDATE public.services
        SET
            calculated_price = v_final_price,
            price_breakdown = v_breakdown
        WHERE id = v_service.id;

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'skipped', v_skipped_count
    );
END;
$$;

-- Grant execute to authenticated users only (not anon)
GRANT EXECUTE ON FUNCTION bulk_recalculate_type_based_prices(uuid[], uuid) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_recalculate_type_based_prices IS
    'Bulk recalculates prices for services using type-based pricing mode. Requires courier role. Uses empty search_path for security.';
