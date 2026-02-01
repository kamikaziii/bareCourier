-- Add coordinate columns for client's default pickup location
-- These store the lat/lng when the address is selected from Mapbox geocoding

ALTER TABLE profiles
ADD COLUMN default_pickup_lat float8,
ADD COLUMN default_pickup_lng float8;

-- Add comment for documentation
COMMENT ON COLUMN profiles.default_pickup_lat IS 'Latitude of client default pickup address (from Mapbox geocoding)';
COMMENT ON COLUMN profiles.default_pickup_lng IS 'Longitude of client default pickup address (from Mapbox geocoding)';
