-- Add duration_minutes column to services table
-- This stores the actual route duration from the routing API (in minutes)

ALTER TABLE services
ADD COLUMN duration_minutes integer;

-- Add comment for documentation
COMMENT ON COLUMN services.duration_minutes IS 'Route duration in minutes from the routing API';
