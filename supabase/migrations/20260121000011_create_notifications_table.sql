-- Notifications table for in-app notifications
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'service_status', 'new_request', 'schedule_change', 'service_created'
    title text NOT NULL,
    message text NOT NULL,
    service_id uuid REFERENCES services(id) ON DELETE SET NULL,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(user_id, read) WHERE read = false;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY notifications_select ON notifications
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Users can update their own notifications (mark as read)
CREATE POLICY notifications_update ON notifications
    FOR UPDATE USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own notifications
CREATE POLICY notifications_delete ON notifications
    FOR DELETE USING (user_id = (SELECT auth.uid()));

-- System can insert notifications (via triggers/functions)
CREATE POLICY notifications_insert ON notifications
    FOR INSERT WITH CHECK (true);

-- Function to create notification when service status changes (for client)
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

        INSERT INTO notifications (user_id, type, title, message, service_id)
        VALUES (client_user_id, 'service_status', notification_title, notification_message, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for client notifications
DROP TRIGGER IF EXISTS notify_client_on_status_change_trigger ON services;
CREATE TRIGGER notify_client_on_status_change_trigger
    AFTER UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION notify_client_on_status_change();

-- Function to notify courier when client creates a service request
CREATE OR REPLACE FUNCTION notify_courier_on_new_service()
RETURNS TRIGGER AS $$
DECLARE
    courier_user_id uuid;
    client_name text;
BEGIN
    -- Get the courier's user_id (assuming only one courier)
    SELECT id INTO courier_user_id FROM profiles WHERE role = 'courier' LIMIT 1;

    -- Get client name
    SELECT name INTO client_name FROM profiles WHERE id = NEW.client_id;

    IF courier_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, service_id)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for courier notifications
DROP TRIGGER IF EXISTS notify_courier_on_new_service_trigger ON services;
CREATE TRIGGER notify_courier_on_new_service_trigger
    AFTER INSERT ON services
    FOR EACH ROW
    EXECUTE FUNCTION notify_courier_on_new_service();
