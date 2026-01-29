-- Migration: Add type-based pricing columns to services
-- Track service type, time preference, zone status, and tolls

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS has_time_preference boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_out_of_zone boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS detected_municipality text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tolls numeric(10,2) DEFAULT 0;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type_id);

COMMENT ON COLUMN services.service_type_id IS 'Service type for type-based pricing';
COMMENT ON COLUMN services.has_time_preference IS 'Whether client selected a time slot (triggers special pricing)';
COMMENT ON COLUMN services.is_out_of_zone IS 'Whether delivery is outside courier distribution zones';
COMMENT ON COLUMN services.detected_municipality IS 'Auto-detected municipality from delivery address';
COMMENT ON COLUMN services.tolls IS 'Toll costs for out-of-zone services';
