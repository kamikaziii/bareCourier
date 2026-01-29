-- Fix function search paths for security
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE OR REPLACE FUNCTION log_service_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.service_status_history (service_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, (SELECT auth.uid()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION notify_client_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    client_user_id uuid;
    notification_title text;
    notification_message text;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        client_user_id := NEW.client_id;

        IF NEW.status = 'delivered' THEN
            notification_title := 'Service Delivered';
            notification_message := 'Your delivery to ' || NEW.delivery_location || ' has been marked as delivered.';
        ELSE
            notification_title := 'Service Status Changed';
            notification_message := 'Your service status has been updated to ' || NEW.status || '.';
        END IF;

        INSERT INTO public.notifications (user_id, type, title, message, service_id)
        VALUES (client_user_id, 'service_status', notification_title, notification_message, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

CREATE OR REPLACE FUNCTION notify_courier_on_new_service()
RETURNS TRIGGER AS $$
DECLARE
    courier_user_id uuid;
    client_name text;
BEGIN
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
