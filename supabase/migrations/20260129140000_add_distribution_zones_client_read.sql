-- Migration: Add read access for authenticated users to distribution_zones
-- Fixes: Clients could not read distribution zones, causing isInDistributionZone() to fail silently
-- This enables zone detection for pricing calculations in the client UI

-- Allow authenticated users to read distribution zones for zone detection
CREATE POLICY "distribution_zones_select_authenticated" ON distribution_zones
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
