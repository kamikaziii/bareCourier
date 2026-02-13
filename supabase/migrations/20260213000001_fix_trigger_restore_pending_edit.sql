-- Fix: Restore client ability to edit pending service requests
--
-- Migration 20260207000001 rewrote check_client_service_update_fields() to fix
-- the suggestion response flow, but accidentally dropped the pending-service
-- exception that 20260121000036 had added. This meant clients could no longer
-- edit locations, notes, coordinates, etc. on their own pending requests.
--
-- This migration restores the IF OLD.request_status = 'pending' THEN RETURN NEW
-- clause while keeping the suggestion response fix from 20260207000001.

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

  -- Fields that clients can NEVER modify, regardless of request_status
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

  -- If service is pending (not yet accepted by courier), allow editing
  -- location, notes, coordinates, distance, urgency, and requested schedule
  IF OLD.request_status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Allow scheduling field changes when responding to a courier suggestion
  -- (request_status transitions from 'suggested' to 'accepted')
  IF OLD.request_status = 'suggested' AND NEW.request_status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- For non-pending services, restrict location/notes/distance fields
  IF NEW.pickup_location IS DISTINCT FROM OLD.pickup_location THEN
    RAISE EXCEPTION 'Clients cannot modify pickup_location on non-pending services';
  END IF;

  IF NEW.delivery_location IS DISTINCT FROM OLD.delivery_location THEN
    RAISE EXCEPTION 'Clients cannot modify delivery_location on non-pending services';
  END IF;

  IF NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng THEN
    RAISE EXCEPTION 'Clients cannot modify pickup coordinates on non-pending services';
  END IF;

  IF NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat
     OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN
    RAISE EXCEPTION 'Clients cannot modify delivery coordinates on non-pending services';
  END IF;

  IF NEW.distance_km IS DISTINCT FROM OLD.distance_km THEN
    RAISE EXCEPTION 'Clients cannot modify distance_km on non-pending services';
  END IF;

  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Clients cannot modify notes on non-pending services';
  END IF;

  IF NEW.urgency_fee_id IS DISTINCT FROM OLD.urgency_fee_id THEN
    RAISE EXCEPTION 'Clients cannot modify urgency_fee_id on non-pending services';
  END IF;

  -- Clients CAN always modify:
  -- - request_status (to accept/decline courier suggestions)
  -- - deleted_at (for soft-delete/cancellation)
  -- - requested_date, requested_time_slot (their own requested schedule)

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_client_service_update_fields() IS
  'Restricts which fields clients can modify on services. For pending services, clients can edit locations, notes, coordinates, distance, and urgency. For non-pending services, clients can only update request_status, deleted_at, and requested schedule fields. Allows scheduling field changes when responding to a courier suggestion (suggested → accepted). Uses empty search_path for security.';
