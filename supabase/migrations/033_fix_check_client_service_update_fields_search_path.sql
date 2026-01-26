-- Fix mutable search_path in check_client_service_update_fields function
-- This prevents schema poisoning attacks by using an empty search_path
-- and fully qualifying all object references

CREATE OR REPLACE FUNCTION check_client_service_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if the user is a client (not courier)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'client'
  ) THEN
    -- Clients can only update specific fields
    -- Check if any restricted fields are being changed
    IF (OLD.pickup_location IS DISTINCT FROM NEW.pickup_location) OR
       (OLD.delivery_location IS DISTINCT FROM NEW.delivery_location) OR
       (OLD.status IS DISTINCT FROM NEW.status) OR
       (OLD.delivered_at IS DISTINCT FROM NEW.delivered_at) OR
       (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) OR
       (OLD.scheduled_time_slot IS DISTINCT FROM NEW.scheduled_time_slot) OR
       (OLD.calculated_price IS DISTINCT FROM NEW.calculated_price) OR
       (OLD.price_breakdown IS DISTINCT FROM NEW.price_breakdown) THEN
      RAISE EXCEPTION 'Clients can only update notes, requested_date, and requested_time_slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_client_service_update_fields() IS 'Restricts client updates to allowed fields only. Uses empty search_path for security.';
