-- Fix terminology: use "deliveries/entregas" instead of "services/serviços" for consistency
-- This aligns with the edge function translations in _shared/translations.ts

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

        -- Daily summary (FIXED: use "deliveries/entregas" terminology)
        WHEN 'daily_summary_title' THEN
            result := CASE locale
                WHEN 'en' THEN 'Daily Summary'
                ELSE 'Resumo do Dia'
            END;
        WHEN 'daily_summary_no_services' THEN
            result := CASE locale
                WHEN 'en' THEN 'No deliveries scheduled for today.'
                ELSE 'Não tem entregas agendadas para hoje.'
            END;
        WHEN 'daily_summary_message' THEN
            result := CASE locale
                WHEN 'en' THEN (params->>'total') || ' deliveries today: ' || (params->>'pending') || ' pending, ' || (params->>'delivered') || ' delivered'
                ELSE (params->>'total') || ' entregas hoje: ' || (params->>'pending') || ' pendentes, ' || (params->>'delivered') || ' entregues'
            END;
        WHEN 'daily_summary_with_urgent' THEN
            result := CASE locale
                WHEN 'en' THEN (params->>'total') || ' deliveries today: ' || (params->>'pending') || ' pending (' || (params->>'urgent') || ' urgent), ' || (params->>'delivered') || ' delivered'
                ELSE (params->>'total') || ' entregas hoje: ' || (params->>'pending') || ' pendentes (' || (params->>'urgent') || ' urgentes), ' || (params->>'delivered') || ' entregues'
            END;

        ELSE
            result := key; -- Fallback to key if not found
    END CASE;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

COMMENT ON FUNCTION get_notification_text IS 'Returns translated notification text. Uses "deliveries/entregas" terminology for user-facing messages.';
