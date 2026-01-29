-- Status history table to track all status changes
CREATE TABLE service_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    changed_at timestamptz DEFAULT now(),
    notes text
);

-- Create index for faster lookups
CREATE INDEX idx_service_status_history_service_id ON service_status_history(service_id);
CREATE INDEX idx_service_status_history_changed_at ON service_status_history(changed_at);

-- Enable RLS
ALTER TABLE service_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies: Clients can see history of their own services, courier can see all
CREATE POLICY service_status_history_select ON service_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM services s
            WHERE s.id = service_status_history.service_id
            AND (
                s.client_id = (SELECT auth.uid())
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = (SELECT auth.uid())
                    AND profiles.role = 'courier'
                )
            )
        )
    );

-- Only courier can insert status history (through service updates)
CREATE POLICY service_status_history_insert ON service_status_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'courier'
        )
    );

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION log_service_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO service_status_history (service_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, (SELECT auth.uid()));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS log_service_status_change_trigger ON services;
CREATE TRIGGER log_service_status_change_trigger
    AFTER UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION log_service_status_change();
