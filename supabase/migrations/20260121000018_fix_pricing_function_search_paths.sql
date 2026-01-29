-- Fix inconsistent search paths in SECURITY DEFINER functions
-- These should use SET search_path = '' (empty string) for security best practices
-- Reference: https://www.postgresql.org/docs/current/sql-createfunction.html

-- Fix update_client_pricing_updated_at function
CREATE OR REPLACE FUNCTION update_client_pricing_updated_at()
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

-- Fix calculate_service_price function
CREATE OR REPLACE FUNCTION calculate_service_price(
  p_client_id uuid,
  p_distance_km decimal,
  p_urgency_fee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_price decimal(10,2),
  price_breakdown jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pricing public.client_pricing%ROWTYPE;
  v_urgency public.urgency_fees%ROWTYPE;
  v_zone_price decimal(10,2);
  v_base decimal(10,2) := 0;
  v_distance_price decimal(10,2) := 0;
  v_urgency_extra decimal(10,2) := 0;
  v_total decimal(10,2) := 0;
BEGIN
  -- Get client pricing configuration
  SELECT * INTO v_pricing FROM public.client_pricing WHERE client_id = p_client_id;

  -- If no pricing configured, return 0
  IF v_pricing IS NULL THEN
    RETURN QUERY SELECT 0::decimal(10,2), '{"error": "No pricing configured"}'::jsonb;
    RETURN;
  END IF;

  -- Calculate base price based on pricing model
  CASE v_pricing.pricing_model
    WHEN 'per_km' THEN
      v_base := v_pricing.base_fee;
      v_distance_price := COALESCE(p_distance_km, 0) * v_pricing.per_km_rate;

    WHEN 'flat_plus_km' THEN
      v_base := v_pricing.base_fee;
      v_distance_price := COALESCE(p_distance_km, 0) * v_pricing.per_km_rate;

    WHEN 'zone' THEN
      -- Find the applicable zone based on distance
      SELECT price INTO v_zone_price
      FROM public.pricing_zones
      WHERE client_id = p_client_id
        AND min_km <= COALESCE(p_distance_km, 0)
        AND (max_km IS NULL OR max_km > COALESCE(p_distance_km, 0))
      LIMIT 1;

      IF v_zone_price IS NULL THEN
        -- No zone found, use base fee
        v_base := v_pricing.base_fee;
      ELSE
        v_base := v_zone_price;
      END IF;
  END CASE;

  -- Calculate urgency fee
  IF p_urgency_fee_id IS NOT NULL THEN
    SELECT * INTO v_urgency FROM public.urgency_fees WHERE id = p_urgency_fee_id AND active = true;
    IF v_urgency IS NOT NULL THEN
      v_urgency_extra := ((v_base + v_distance_price) * (v_urgency.multiplier - 1)) + v_urgency.flat_fee;
    END IF;
  END IF;

  v_total := v_base + v_distance_price + v_urgency_extra;

  RETURN QUERY SELECT
    v_total,
    jsonb_build_object(
      'base', v_base,
      'distance', v_distance_price,
      'urgency', v_urgency_extra,
      'total', v_total,
      'model', v_pricing.pricing_model,
      'distance_km', COALESCE(p_distance_km, 0)
    );
END;
$$;
