-- Fix 1: Update notifications type constraint to include all valid types
-- The original constraint was missing 'past_due' and 'daily_summary'
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('service_status', 'new_request', 'schedule_change', 'service_created', 'past_due', 'daily_summary'));

-- Fix 2: Update trigger to only notify courier on actual CLIENT requests
-- Previously it fired on ALL service inserts, including courier-created services
CREATE OR REPLACE FUNCTION notify_courier_on_new_service()
RETURNS TRIGGER AS $$
DECLARE
    courier_user_id uuid;
    client_name text;
BEGIN
    -- Only notify for actual client requests (request_status = 'pending')
    -- Skip courier-created services (request_status = 'accepted' or NULL)
    IF NEW.request_status IS NULL OR NEW.request_status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- Get the courier's user_id (assuming only one courier)
    SELECT id INTO courier_user_id FROM public.profiles WHERE role = 'courier' LIMIT 1;

    -- Get client name
    SELECT name INTO client_name FROM public.profiles WHERE id = NEW.client_id;

    IF courier_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, service_id)
        VALUES (
            courier_user_id,
            'new_request',
            'New Service Request',
            'New request from ' || COALESCE(client_name, 'Unknown Client') || ' - ' || NEW.pickup_location || ' to ' || NEW.delivery_location,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION notify_courier_on_new_service IS 'Notifies courier only when a CLIENT creates a service request (request_status = pending). Does not fire for courier-created services.';
