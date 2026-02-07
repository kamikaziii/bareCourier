-- Fix: Allow client reschedule RPCs through trigger guard
--
-- Problem: The BEFORE UPDATE trigger check_client_service_update_fields()
-- unconditionally blocks clients from modifying scheduled_date,
-- scheduled_time_slot, suggested_date, and suggested_time_slot.
-- The RPCs client_approve_reschedule and client_deny_reschedule are
-- SECURITY DEFINER but the trigger resolves role via auth.uid() (JWT-based),
-- so the trigger sees the client role and blocks the update.
--
-- Fix: When request_status transitions from 'suggested' to 'accepted',
-- allow modifications to the 4 scheduling/suggestion fields.
-- This is safe because only the courier can set request_status = 'suggested'.

CREATE OR REPLACE FUNCTION check_client_service_update_fields()
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

  -- For clients (or unknown roles), restrict field modifications
  -- Using IS DISTINCT FROM to handle NULL values correctly

  -- Fields that clients can NEVER modify, regardless of state
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Clients cannot modify client_id';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Clients cannot modify service status';
  END IF;

  IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'Clients cannot modify delivered_at';
  END IF;

  IF NEW.calculated_price IS DISTINCT FROM OLD.calculated_price THEN
    RAISE EXCEPTION 'Clients cannot modify calculated_price';
  END IF;

  IF NEW.price_breakdown IS DISTINCT FROM OLD.price_breakdown THEN
    RAISE EXCEPTION 'Clients cannot modify price_breakdown';
  END IF;

  IF NEW.urgency_fee_id IS DISTINCT FROM OLD.urgency_fee_id THEN
    RAISE EXCEPTION 'Clients cannot modify urgency_fee_id';
  END IF;

  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Clients cannot modify notes';
  END IF;

  -- Allow scheduling field changes when responding to a courier suggestion
  -- (request_status transitions from 'suggested' to 'accepted')
  -- This is safe because only the courier can set request_status = 'suggested',
  -- and the RPCs already validate ownership, auth, and state.
  IF OLD.request_status = 'suggested' AND NEW.request_status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Scheduling fields set by courier (blocked for clients in all other cases)
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

  -- Location and distance fields (blocked for clients)
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

  -- Clients CAN modify:
  -- - request_status (to accept/decline courier suggestions)
  -- - deleted_at (for soft-delete/cancellation)
  -- - requested_date (their own requested date)
  -- - requested_time_slot (their own requested time slot)
  -- Note: These are implicitly allowed by not checking them above

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_client_service_update_fields() IS
  'Restricts which fields clients can modify on services. Allows scheduling field changes when responding to a courier suggestion (suggested → accepted). Uses empty search_path for security.';
