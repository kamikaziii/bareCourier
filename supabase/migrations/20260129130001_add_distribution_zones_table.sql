-- Migration: Add distribution_zones table for geographic zone pricing
-- Stores municipalities (concelhos) that are "in zone" for the courier
-- Services delivered outside these zones will have different pricing (base + per km + tolls)

CREATE TABLE distribution_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distrito text NOT NULL,
  concelho text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(distrito, concelho)
);

-- Indexes for lookups
CREATE INDEX idx_distribution_zones_concelho ON distribution_zones(concelho);
CREATE INDEX idx_distribution_zones_distrito ON distribution_zones(distrito);

-- Enable RLS
ALTER TABLE distribution_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Use is_courier() helper for consistency with other tables
-- Only courier can manage distribution zones (admin configuration)

-- Courier can read all distribution zones
CREATE POLICY "distribution_zones_select_courier" ON distribution_zones
  FOR SELECT
  USING (public.is_courier());

-- Courier can insert new distribution zones
CREATE POLICY "distribution_zones_insert_courier" ON distribution_zones
  FOR INSERT
  WITH CHECK (public.is_courier());

-- Courier can update distribution zones
CREATE POLICY "distribution_zones_update_courier" ON distribution_zones
  FOR UPDATE
  USING (public.is_courier());

-- Courier can delete distribution zones
CREATE POLICY "distribution_zones_delete_courier" ON distribution_zones
  FOR DELETE
  USING (public.is_courier());

COMMENT ON TABLE distribution_zones IS 'Geographic zones (municipalities) for type-based pricing';
