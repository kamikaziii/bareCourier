-- Add locale column to profiles (default pt-PT to match app default)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS locale text DEFAULT 'pt-PT';

COMMENT ON COLUMN profiles.locale IS 'User language preference: pt-PT or en';

-- Helper function to get translated notification text
CREATE OR REPLACE FUNCTION get_notification_text(
    key text,
    locale text,
    params jsonb DEFAULT '{}'::jsonb
) RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- Translation lookup
    CASE key
        -- New service request
        WHEN 'new_request_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'New Service Request'
                ELSE 'Novo Pedido de Serviço'
            END;
        WHEN 'new_request_message' THEN
            result := CASE locale
                WHEN 'en' THEN 'New request from ' || (params->>'client_name') || ' - ' || (params->>'pickup') || ' to ' || (params->>'delivery')
                ELSE 'Novo pedido de ' || (params->>'client_name') || ' - ' || (params->>'pickup') || ' para ' || (params->>'delivery')
            END;

        -- Service delivered
        WHEN 'service_delivered_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'Service Delivered'
                ELSE 'Serviço Entregue'
            END;
        WHEN 'service_delivered_message' THEN
            result := CASE locale
                WHEN 'en' THEN 'Your delivery to ' || (params->>'location') || ' has been marked as delivered.'
                ELSE 'A sua entrega para ' || (params->>'location') || ' foi marcada como entregue.'
            END;

        -- Service status changed
        WHEN 'status_changed_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'Service Status Changed'
                ELSE 'Estado do Serviço Alterado'
            END;
        WHEN 'status_changed_message' THEN
            result := CASE locale
                WHEN 'en' THEN 'Your service status has been updated to ' || (params->>'status') || '.'
                ELSE 'O estado do seu serviço foi atualizado para ' || (params->>'status') || '.'
            END;

        -- Past due
        WHEN 'past_due_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'Past Due Delivery'
                ELSE 'Entrega Atrasada'
            END;
        WHEN 'past_due_message' THEN
            result := CASE locale
                WHEN 'en' THEN 'Delivery for ' || (params->>'client_name') || ' is ' || (params->>'overdue_text') || ' overdue'
                ELSE 'Entrega de ' || (params->>'client_name') || ' está ' || (params->>'overdue_text') || ' atrasada'
            END;

        -- Daily summary
        WHEN 'daily_summary_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'Daily Summary'
                ELSE 'Resumo do Dia'
            END;
        WHEN 'daily_summary_no_services' THEN
            result := CASE locale
                WHEN 'en' THEN 'No services scheduled for today.'
                ELSE 'Nenhum serviço agendado para hoje.'
            END;
        WHEN 'daily_summary_message' THEN
            result := CASE locale
                WHEN 'en' THEN (params->>'total') || ' services today: ' || (params->>'pending') || ' pending, ' || (params->>'delivered') || ' delivered'
                ELSE (params->>'total') || ' serviços hoje: ' || (params->>'pending') || ' pendentes, ' || (params->>'delivered') || ' entregues'
            END;
        WHEN 'daily_summary_with_urgent' THEN
            result := CASE locale
                WHEN 'en' THEN (params->>'total') || ' services today: ' || (params->>'pending') || ' pending (' || (params->>'urgent') || ' urgent), ' || (params->>'delivered') || ' delivered'
                ELSE (params->>'total') || ' serviços hoje: ' || (params->>'pending') || ' pendentes (' || (params->>'urgent') || ' urgentes), ' || (params->>'delivered') || ' entregues'
            END;

        ELSE
            result := key; -- Fallback to key if not found
    END CASE;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- Update notify_client_on_status_change to use i18n
CREATE OR REPLACE FUNCTION notify_client_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    client_user_id uuid;
    client_locale text;
    notification_title text;
    notification_message text;
BEGIN
    -- Only notify on status change
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get client's user_id and locale
    SELECT id, COALESCE(locale, 'pt-PT') INTO client_user_id, client_locale
    FROM public.profiles
    WHERE id = NEW.client_id;

    IF client_user_id IS NOT NULL THEN
        IF NEW.status = 'delivered' THEN
            notification_title := public.get_notification_text('service_delivered_title', client_locale);
            notification_message := public.get_notification_text('service_delivered_message', client_locale,
                jsonb_build_object('location', NEW.delivery_location));
        ELSE
            notification_title := public.get_notification_text('status_changed_title', client_locale);
            notification_message := public.get_notification_text('status_changed_message', client_locale,
                jsonb_build_object('status', NEW.status));
        END IF;

        INSERT INTO public.notifications (user_id, type, title, message, service_id)
        VALUES (client_user_id, 'service_status', notification_title, notification_message, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Update notify_courier_on_new_service to use i18n
CREATE OR REPLACE FUNCTION notify_courier_on_new_service()
RETURNS TRIGGER AS $$
DECLARE
    courier_user_id uuid;
    courier_locale text;
    client_name text;
    notification_title text;
    notification_message text;
BEGIN
    -- Only notify for actual client requests (request_status = 'pending')
    -- Skip courier-created services (request_status = 'accepted' or NULL)
    IF NEW.request_status IS NULL OR NEW.request_status != 'pending' THEN
        RETURN NEW;
    END IF;

    -- Get the courier's user_id and locale
    SELECT id, COALESCE(locale, 'pt-PT') INTO courier_user_id, courier_locale
    FROM public.profiles
    WHERE role = 'courier'
    LIMIT 1;

    -- Get client name
    SELECT name INTO client_name FROM public.profiles WHERE id = NEW.client_id;

    IF courier_user_id IS NOT NULL THEN
        notification_title := public.get_notification_text('new_request_title', courier_locale);
        notification_message := public.get_notification_text('new_request_message', courier_locale,
            jsonb_build_object(
                'client_name', COALESCE(client_name, 'Unknown'),
                'pickup', NEW.pickup_location,
                'delivery', NEW.delivery_location
            ));

        INSERT INTO public.notifications (user_id, type, title, message, service_id)
        VALUES (
            courier_user_id,
            'new_request',
            notification_title,
            notification_message,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

COMMENT ON FUNCTION notify_courier_on_new_service IS 'Notifies courier (in their preferred language) when a CLIENT creates a service request. Does not fire for courier-created services.';
COMMENT ON FUNCTION notify_client_on_status_change IS 'Notifies client (in their preferred language) when their service status changes.';
