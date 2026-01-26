-- Create RPC function for bulk price recalculation
-- Fixes N+1 query issue by fetching config once and batch updating all services
-- Used by recalculateMissing and recalculateAll actions

CREATE OR REPLACE FUNCTION bulk_recalculate_service_prices(
    p_service_ids uuid[],
    p_client_id uuid,
    p_minimum_charge numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_pricing_config record;
    v_zones jsonb;
    v_urgency_fees jsonb;
    v_service record;
    v_base_price numeric;
    v_zone_price numeric;
    v_urgency_fee record;
    v_urgency_amount numeric;
    v_final_price numeric;
    v_breakdown jsonb;
    v_updated_count integer := 0;
    v_skipped_count integer := 0;
BEGIN
    -- Fetch client pricing config once
    SELECT
        cp.pricing_model,
        cp.base_fee,
        cp.per_km_rate
    INTO v_pricing_config
    FROM public.client_pricing cp
    WHERE cp.client_id = p_client_id;

    -- If no pricing config, return early
    IF v_pricing_config IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No pricing configuration for this client',
            'updated', 0,
            'skipped', 0
        );
    END IF;

    -- Fetch pricing zones if zone-based model (as JSON array)
    IF v_pricing_config.pricing_model = 'zone' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'min_km', pz.min_km,
                'max_km', pz.max_km,
                'price', pz.price
            ) ORDER BY pz.min_km
        ), '[]'::jsonb)
        INTO v_zones
        FROM public.pricing_zones pz
        WHERE pz.client_id = p_client_id;
    ELSE
        v_zones := '[]'::jsonb;
    END IF;

    -- Fetch all active urgency fees as a lookup map
    SELECT COALESCE(jsonb_object_agg(
        uf.id::text,
        jsonb_build_object(
            'multiplier', uf.multiplier,
            'flat_fee', uf.flat_fee
        )
    ), '{}'::jsonb)
    INTO v_urgency_fees
    FROM public.urgency_fees uf
    WHERE uf.active = true;

    -- Process each service
    FOR v_service IN
        SELECT s.id, s.distance_km, s.urgency_fee_id
        FROM public.services s
        WHERE s.id = ANY(p_service_ids)
          AND s.distance_km IS NOT NULL
    LOOP
        -- Calculate base price based on pricing model
        CASE v_pricing_config.pricing_model
            WHEN 'per_km', 'flat_plus_km' THEN
                v_base_price := v_pricing_config.base_fee + (v_service.distance_km * v_pricing_config.per_km_rate);

            WHEN 'zone' THEN
                -- Find matching zone
                v_zone_price := NULL;
                SELECT (z->>'price')::numeric INTO v_zone_price
                FROM jsonb_array_elements(v_zones) AS z
                WHERE v_service.distance_km >= (z->>'min_km')::numeric
                  AND (z->>'max_km' IS NULL OR (z->>'max_km')::numeric IS NULL OR v_service.distance_km < (z->>'max_km')::numeric)
                LIMIT 1;

                IF v_zone_price IS NULL THEN
                    -- No matching zone, skip this service
                    v_skipped_count := v_skipped_count + 1;
                    CONTINUE;
                END IF;
                v_base_price := v_zone_price;

            ELSE
                -- Unknown pricing model, skip
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
        END CASE;

        -- Apply urgency fee if present
        v_urgency_amount := 0;
        v_final_price := v_base_price;

        IF v_service.urgency_fee_id IS NOT NULL AND v_urgency_fees ? v_service.urgency_fee_id::text THEN
            v_urgency_amount := v_base_price * ((v_urgency_fees->v_service.urgency_fee_id::text->>'multiplier')::numeric - 1)
                              + (v_urgency_fees->v_service.urgency_fee_id::text->>'flat_fee')::numeric;
            v_final_price := v_base_price + v_urgency_amount;
        END IF;

        -- Apply minimum charge
        v_final_price := GREATEST(v_final_price, p_minimum_charge);

        -- Round to 2 decimal places
        v_final_price := ROUND(v_final_price, 2);

        -- Build breakdown
        v_breakdown := jsonb_build_object(
            'base', v_pricing_config.base_fee,
            'distance', CASE v_pricing_config.pricing_model
                WHEN 'zone' THEN v_zone_price
                ELSE v_service.distance_km * v_pricing_config.per_km_rate
            END,
            'urgency', v_urgency_amount,
            'total', v_final_price,
            'model', v_pricing_config.pricing_model,
            'distance_km', v_service.distance_km
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION bulk_recalculate_service_prices(uuid[], uuid, numeric) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION bulk_recalculate_service_prices IS
    'Bulk recalculates prices for multiple services. Fetches config once, updates all in single transaction. Returns {success, updated, skipped}.';
