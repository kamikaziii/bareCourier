-- Fix Phase 1 Security Issues
-- 2025-01-21

-- 1. Fix services_update to check deleted_at
DROP POLICY IF EXISTS services_update ON services;
CREATE POLICY services_update ON services
    FOR UPDATE USING (
        is_courier() AND deleted_at IS NULL
    );

-- 2. Remove overly permissive notifications_insert policy
-- Triggers use SECURITY DEFINER so they still work
DROP POLICY IF EXISTS notifications_insert ON notifications;

-- 3. Fix update_updated_at_column security
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 4. Add type constraint to notifications
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('service_status', 'new_request', 'schedule_change', 'service_created'));
