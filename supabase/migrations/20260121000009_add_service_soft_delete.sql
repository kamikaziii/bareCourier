-- Add soft delete and updated_at to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE services ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for services updated_at
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing rows to have updated_at set
UPDATE services SET updated_at = COALESCE(delivered_at, created_at) WHERE updated_at IS NULL;

-- Update RLS policies to exclude soft-deleted services
DROP POLICY IF EXISTS services_select ON services;
CREATE POLICY services_select ON services
    FOR SELECT USING (
        deleted_at IS NULL AND (
            client_id = (SELECT auth.uid())
            OR EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = (SELECT auth.uid())
                AND profiles.role = 'courier'
            )
        )
    );

-- Allow courier to see deleted services if needed (for audit)
DROP POLICY IF EXISTS services_select_deleted ON services;
CREATE POLICY services_select_deleted ON services
    FOR SELECT USING (
        deleted_at IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = (SELECT auth.uid())
            AND profiles.role = 'courier'
        )
    );
