-- Migration: Restrict client service update fields
--
-- Problem: RLS policy (019) allows clients to update ANY field on services
-- with request_status IN ('pending', 'suggested'). This is a security issue
-- as clients could modify calculated_price, locations, etc.
--
-- Solution: Add a BEFORE UPDATE trigger that validates which fields are being
-- changed based on the user's role. Clients can only modify:
--   - request_status (to accept/decline suggestions)
--   - deleted_at (for soft-delete/cancellation)

-- Create the trigger function to check client update fields
CREATE OR REPLACE FUNCTION check_client_service_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the user's role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = (SELECT auth.uid());

  -- Couriers can update anything
  IF user_role = 'courier' THEN
    RETURN NEW;
  END IF;

  -- For clients (or unknown roles), restrict field modifications
  -- Using IS DISTINCT FROM to handle NULL values correctly
  IF NEW.calculated_price IS DISTINCT FROM OLD.calculated_price THEN
    RAISE EXCEPTION 'Clients cannot modify calculated_price';
  END IF;

  IF NEW.price_breakdown IS DISTINCT FROM OLD.price_breakdown THEN
    RAISE EXCEPTION 'Clients cannot modify price_breakdown';
  END IF;

  IF NEW.pickup_location IS DISTINCT FROM OLD.pickup_location THEN
    RAISE EXCEPTION 'Clients cannot modify pickup_location';
  END IF;

  IF NEW.delivery_location IS DISTINCT FROM OLD.delivery_location THEN
    RAISE EXCEPTION 'Clients cannot modify delivery_location';
  END IF;

  IF NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng THEN
    RAISE EXCEPTION 'Clients cannot modify pickup coordinates';
  END IF;

  IF NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat
     OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN
    RAISE EXCEPTION 'Clients cannot modify delivery coordinates';
  END IF;

  IF NEW.distance_km IS DISTINCT FROM OLD.distance_km THEN
    RAISE EXCEPTION 'Clients cannot modify distance_km';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Clients cannot modify service status';
  END IF;

  IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'Clients cannot modify delivered_at';
  END IF;

  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Clients cannot modify notes';
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Clients cannot modify client_id';
  END IF;

  IF NEW.urgency_fee_id IS DISTINCT FROM OLD.urgency_fee_id THEN
    RAISE EXCEPTION 'Clients cannot modify urgency_fee_id';
  END IF;

  -- Scheduling fields set by courier
  IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
    RAISE EXCEPTION 'Clients cannot modify scheduled_date';
  END IF;

  IF NEW.scheduled_time_slot IS DISTINCT FROM OLD.scheduled_time_slot THEN
    RAISE EXCEPTION 'Clients cannot modify scheduled_time_slot';
  END IF;

  IF NEW.suggested_date IS DISTINCT FROM OLD.suggested_date THEN
    RAISE EXCEPTION 'Clients cannot modify suggested_date';
  END IF;

  IF NEW.suggested_time_slot IS DISTINCT FROM OLD.suggested_time_slot THEN
    RAISE EXCEPTION 'Clients cannot modify suggested_time_slot';
  END IF;

  -- Clients CAN modify:
  -- - request_status (to accept/decline courier suggestions)
  -- - deleted_at (for soft-delete/cancellation)
  -- - requested_date (their own requested date)
  -- - requested_time_slot (their own requested time slot)
  -- Note: These are implicitly allowed by not checking them above

  RETURN NEW;
END;
$$;

-- Create the trigger (drop if exists for idempotency)
DROP TRIGGER IF EXISTS check_client_service_update ON services;

CREATE TRIGGER check_client_service_update
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION check_client_service_update_fields();

-- Add comment for documentation
COMMENT ON FUNCTION check_client_service_update_fields() IS
  'Restricts which fields clients can modify on services. Clients can only update: request_status, deleted_at, requested_date, requested_time_slot. Couriers can update any field.';

COMMENT ON TRIGGER check_client_service_update ON services IS
  'Enforces field-level update restrictions for clients. See TODO #032 for context.';
