-- Phase 3: Zone-based pricing
-- For clients using 'zone' pricing model, defines price tiers by distance

CREATE TABLE pricing_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  min_km decimal(10,2) NOT NULL DEFAULT 0,
  max_km decimal(10,2), -- NULL means unlimited (e.g., 20+ km)
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(client_id, min_km)
);

-- Create index for fast lookups
CREATE INDEX idx_pricing_zones_client_id ON pricing_zones(client_id);
CREATE INDEX idx_pricing_zones_distance ON pricing_zones(client_id, min_km, max_km);

-- Enable RLS
ALTER TABLE pricing_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Courier can do everything, clients can view their own
CREATE POLICY "pricing_zones_select_courier" ON pricing_zones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "pricing_zones_select_own" ON pricing_zones
  FOR SELECT
  USING (client_id = (SELECT auth.uid()));

CREATE POLICY "pricing_zones_insert_courier" ON pricing_zones
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "pricing_zones_update_courier" ON pricing_zones
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "pricing_zones_delete_courier" ON pricing_zones
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );
