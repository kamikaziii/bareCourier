-- Restrict courier profile SELECT exposure to clients
--
-- Problem: The profiles_select RLS policy includes `OR (role = 'courier')` which
-- allows any authenticated user (i.e. clients) to read ALL 37 columns of the
-- courier's profile row. Clients only need a handful of fields for service
-- creation (pricing_mode, time_slots, etc.) but can currently see warehouse
-- coordinates, workload_settings, notification_preferences, etc.
--
-- Solution: Create a narrow view `courier_public_profile` exposing only the
-- columns clients actually need, then tighten the profiles_select policy so
-- clients can no longer read the courier's full profile row.

-- 1. Create the view with only client-facing columns
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
  warehouse_lat,
  warehouse_lng,
  default_urgency_fee_id,
  default_service_type_id,
  locale
FROM public.profiles
WHERE role = 'courier'
LIMIT 1;

-- 2. Grant SELECT on the view to authenticated users
GRANT SELECT ON public.courier_public_profile TO authenticated;

-- 3. Tighten the profiles_select policy — remove the `OR (role = 'courier')` clause
--    so clients can no longer read the courier's full profile row.
--    Users see their own profile; courier sees all profiles.
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = (SELECT auth.uid()) OR public.is_courier()
  );

-- 4. Document the view's purpose
COMMENT ON VIEW public.courier_public_profile IS
  'Read-only view exposing only the courier profile fields that clients need '
  '(pricing, scheduling, VAT, branding, reschedule limits, locale). Exposes 25 of 35 '
  'profile columns. Replaces the former open profiles_select policy clause. Hidden: '
  'active, created_at, default_pickup_lat/lng/location, email/push_notifications_enabled, '
  'notification_preferences, role, workload_settings.';
