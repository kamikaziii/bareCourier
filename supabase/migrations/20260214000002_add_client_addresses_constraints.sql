-- Add CHECK constraints and unique index to client_addresses
-- (Original migration 20260214000001 was applied without these)

-- Length constraints
ALTER TABLE client_addresses
  ADD CONSTRAINT client_addresses_label_length CHECK (char_length(label) BETWEEN 1 AND 100);

ALTER TABLE client_addresses
  ADD CONSTRAINT client_addresses_address_length CHECK (char_length(address) BETWEEN 1 AND 500);

-- Lat/lng must be both null or both non-null
ALTER TABLE client_addresses
  ADD CONSTRAINT lat_lng_both_or_neither CHECK (
    (lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)
  );

-- Coordinate range validation
ALTER TABLE client_addresses
  ADD CONSTRAINT valid_lat CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90));

ALTER TABLE client_addresses
  ADD CONSTRAINT valid_lng CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180));

-- Prevent duplicate labels per client (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_addresses_unique_label
  ON client_addresses(client_id, lower(label));
