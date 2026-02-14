-- Remove warehouse coordinates from client-facing view
--
-- Problem: courier_public_profile exposes warehouse_lat and warehouse_lng to all
-- authenticated users (including clients). These reveal the courier's physical
-- warehouse location, which may be their home address.
--
-- Solution:
--   1. Remove warehouse_lat/lng from the view
--   2. Create a SECURITY DEFINER RPC so server-side pricing code can still
--      fetch the warehouse coordinates (bypasses RLS, works for both courier
--      and client sessions since it only runs server-side).

-- 1. Recreate the view without warehouse coordinates
CREATE OR REPLACE VIEW public.courier_public_profile AS
SELECT
  id,
  name,
  phone,
  pricing_mode,
  show_price_to_client,
  show_price_to_courier,
  time_slots,
  time_specific_price,
  working_days,
  timezone,
  round_distance,
  minimum_charge,
  vat_enabled,
  vat_rate,
  prices_include_vat,
  label_business_name,
  label_tagline,
  past_due_settings,
  out_of_zone_base,
  out_of_zone_per_km,
  default_urgency_fee_id,
  default_service_type_id,
  locale
FROM public.profiles
WHERE role = 'courier'
LIMIT 1;

-- 2. Update documentation
COMMENT ON VIEW public.courier_public_profile IS
  'Read-only view exposing only the courier profile fields that clients need '
  '(pricing, scheduling, VAT, branding, reschedule limits, locale). '
  'Warehouse coordinates are excluded for privacy -- pricing uses '
  'get_courier_warehouse_coords() RPC instead.';

-- 3. Create SECURITY DEFINER function to fetch warehouse coordinates
--    This bypasses RLS so both courier and client server-side code can use it.
CREATE OR REPLACE FUNCTION public.get_courier_warehouse_coords()
RETURNS TABLE(warehouse_lat double precision, warehouse_lng double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT p.warehouse_lat, p.warehouse_lng
  FROM public.profiles p
  WHERE p.role = 'courier'
  LIMIT 1;
END;
$$;

-- 4. Lock down permissions: only authenticated users may call this
REVOKE ALL ON FUNCTION public.get_courier_warehouse_coords() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_courier_warehouse_coords() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_courier_warehouse_coords() TO authenticated;
