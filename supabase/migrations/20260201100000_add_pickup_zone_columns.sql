-- Add pickup zone tracking columns to services table
-- Allows checking if EITHER pickup OR delivery is out of zone

ALTER TABLE services
ADD COLUMN pickup_is_out_of_zone boolean,
ADD COLUMN pickup_detected_municipality text;

-- Add comment for documentation
COMMENT ON COLUMN services.pickup_is_out_of_zone IS 'Whether pickup location is outside courier distribution zones';
COMMENT ON COLUMN services.pickup_detected_municipality IS 'Detected municipality from geocoding for pickup address';
