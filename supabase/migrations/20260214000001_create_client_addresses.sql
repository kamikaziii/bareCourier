-- Create client_addresses table for client address book feature
CREATE TABLE client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  address text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 500),
  lat float8,
  lng float8,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT lat_lng_both_or_neither CHECK ((lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL)),
  CONSTRAINT valid_lat CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT valid_lng CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
);

-- Index for fast lookups by client
CREATE INDEX idx_client_addresses_client_id ON client_addresses(client_id);

-- Enable RLS
ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

-- Client-only policies: fully private, no courier access
DROP POLICY IF EXISTS client_addresses_select ON client_addresses;
CREATE POLICY client_addresses_select ON client_addresses
  FOR SELECT TO authenticated
  USING (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_insert ON client_addresses;
CREATE POLICY client_addresses_insert ON client_addresses
  FOR INSERT TO authenticated
  WITH CHECK (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_update ON client_addresses;
CREATE POLICY client_addresses_update ON client_addresses
  FOR UPDATE TO authenticated
  USING (client_id = (SELECT auth.uid()))
  WITH CHECK (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS client_addresses_delete ON client_addresses;
CREATE POLICY client_addresses_delete ON client_addresses
  FOR DELETE TO authenticated
  USING (client_id = (SELECT auth.uid()));

-- Prevent duplicate labels per client (case-insensitive)
CREATE UNIQUE INDEX idx_client_addresses_unique_label ON client_addresses(client_id, lower(label));
