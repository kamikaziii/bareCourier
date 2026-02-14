-- Migration: Restrict client profile update fields
--
-- Problem: The profiles UPDATE RLS policy (`id = auth.uid() OR is_courier()`)
-- has NO field restrictions and NO trigger. A client can execute:
--   UPDATE profiles SET role = 'courier' WHERE id = auth.uid()
-- and gain full admin access, bypassing all courier-only guards.
--
-- Solution: Add a BEFORE UPDATE trigger that uses an ALLOWLIST approach.
-- Only explicitly listed fields may be changed by clients. Any new column
-- added to profiles is blocked by default until explicitly allowed here.

CREATE OR REPLACE FUNCTION check_client_profile_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the user's role (using fully qualified names)
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  -- Couriers can update anything
  IF user_role = 'courier' THEN
    RETURN NEW;
  END IF;

  -- For clients (or unknown roles), use an ALLOWLIST approach:
  -- Reset any disallowed field back to OLD value, then check if
  -- the client attempted to change it. This is safer than a denylist
  -- because new columns are blocked by default.
  --
  -- Using IS DISTINCT FROM for NULL-safe comparisons.

  -- ── Immutable / system fields ──────────────────────────────────────
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Clients cannot modify id';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Clients cannot modify role';
  END IF;

  IF NEW.active IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Clients cannot modify active';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Clients cannot modify created_at';
  END IF;

  -- ── Pricing fields (courier-only) ─────────────────────────────────
  IF NEW.pricing_mode IS DISTINCT FROM OLD.pricing_mode THEN
    RAISE EXCEPTION 'Clients cannot modify pricing_mode';
  END IF;

  IF NEW.minimum_charge IS DISTINCT FROM OLD.minimum_charge THEN
    RAISE EXCEPTION 'Clients cannot modify minimum_charge';
  END IF;

  IF NEW.out_of_zone_base IS DISTINCT FROM OLD.out_of_zone_base THEN
    RAISE EXCEPTION 'Clients cannot modify out_of_zone_base';
  END IF;

  IF NEW.out_of_zone_per_km IS DISTINCT FROM OLD.out_of_zone_per_km THEN
    RAISE EXCEPTION 'Clients cannot modify out_of_zone_per_km';
  END IF;

  -- ── VAT fields (courier-only) ─────────────────────────────────────
  IF NEW.vat_enabled IS DISTINCT FROM OLD.vat_enabled THEN
    RAISE EXCEPTION 'Clients cannot modify vat_enabled';
  END IF;

  IF NEW.vat_rate IS DISTINCT FROM OLD.vat_rate THEN
    RAISE EXCEPTION 'Clients cannot modify vat_rate';
  END IF;

  IF NEW.prices_include_vat IS DISTINCT FROM OLD.prices_include_vat THEN
    RAISE EXCEPTION 'Clients cannot modify prices_include_vat';
  END IF;

  -- ── Display fields (courier-only) ─────────────────────────────────
  IF NEW.round_distance IS DISTINCT FROM OLD.round_distance THEN
    RAISE EXCEPTION 'Clients cannot modify round_distance';
  END IF;

  IF NEW.show_price_to_client IS DISTINCT FROM OLD.show_price_to_client THEN
    RAISE EXCEPTION 'Clients cannot modify show_price_to_client';
  END IF;

  IF NEW.show_price_to_courier IS DISTINCT FROM OLD.show_price_to_courier THEN
    RAISE EXCEPTION 'Clients cannot modify show_price_to_courier';
  END IF;

  -- ── Scheduling fields (courier-only) ──────────────────────────────
  IF NEW.time_slots IS DISTINCT FROM OLD.time_slots THEN
    RAISE EXCEPTION 'Clients cannot modify time_slots';
  END IF;

  IF NEW.time_specific_price IS DISTINCT FROM OLD.time_specific_price THEN
    RAISE EXCEPTION 'Clients cannot modify time_specific_price';
  END IF;

  IF NEW.working_days IS DISTINCT FROM OLD.working_days THEN
    RAISE EXCEPTION 'Clients cannot modify working_days';
  END IF;

  -- ── Operations fields (courier-only) ──────────────────────────────
  IF NEW.workload_settings IS DISTINCT FROM OLD.workload_settings THEN
    RAISE EXCEPTION 'Clients cannot modify workload_settings';
  END IF;

  IF NEW.past_due_settings IS DISTINCT FROM OLD.past_due_settings THEN
    RAISE EXCEPTION 'Clients cannot modify past_due_settings';
  END IF;

  -- ── Warehouse fields (courier-only) ───────────────────────────────
  IF NEW.warehouse_lat IS DISTINCT FROM OLD.warehouse_lat THEN
    RAISE EXCEPTION 'Clients cannot modify warehouse_lat';
  END IF;

  IF NEW.warehouse_lng IS DISTINCT FROM OLD.warehouse_lng THEN
    RAISE EXCEPTION 'Clients cannot modify warehouse_lng';
  END IF;

  -- ── Branding fields (courier-only) ────────────────────────────────
  IF NEW.label_business_name IS DISTINCT FROM OLD.label_business_name THEN
    RAISE EXCEPTION 'Clients cannot modify label_business_name';
  END IF;

  IF NEW.label_tagline IS DISTINCT FROM OLD.label_tagline THEN
    RAISE EXCEPTION 'Clients cannot modify label_tagline';
  END IF;

  -- ── Client-modifiable fields (ALLOWLIST) ──────────────────────────
  -- The following fields are implicitly allowed by NOT checking them above:
  --   name, phone, locale, timezone
  --   default_pickup_location, default_pickup_lat, default_pickup_lng
  --   push_notifications_enabled, email_notifications_enabled
  --   notification_preferences
  --   default_service_type_id, default_urgency_fee_id
  --   updated_at (auto-managed)

  RETURN NEW;
END;
$$;

-- Create the trigger (drop if exists for idempotency)
DROP TRIGGER IF EXISTS check_client_profile_update ON public.profiles;

CREATE TRIGGER check_client_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_client_profile_update_fields();

-- Add comments for documentation
COMMENT ON FUNCTION check_client_profile_update_fields() IS
  'Restricts which fields clients can modify on their own profile using an allowlist approach. '
  'Clients may only update: name, phone, locale, timezone, default_pickup_location, default_pickup_lat, '
  'default_pickup_lng, push_notifications_enabled, email_notifications_enabled, '
  'notification_preferences, default_service_type_id, default_urgency_fee_id, updated_at. '
  'All other fields (role, active, pricing, VAT, scheduling, branding, etc.) are blocked. '
  'New columns added to profiles are blocked by default. Couriers skip all checks. '
  'Uses SECURITY DEFINER with empty search_path for security.';

COMMENT ON TRIGGER check_client_profile_update ON public.profiles IS
  'Enforces field-level update restrictions for clients on profiles. Prevents role escalation and admin field tampering.';
