-- Migration: Add type-based pricing columns to profiles
-- Courier settings for type-based pricing mode

-- Add pricing_mode column (update existing constraint if needed)
DO $$
BEGIN
  -- Check if pricing_mode already exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'profiles' AND column_name = 'pricing_mode') THEN
    -- Update the constraint to include 'type'
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pricing_mode_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_pricing_mode_check
      CHECK (pricing_mode IS NULL OR pricing_mode IN ('warehouse', 'zone', 'type'));
  ELSE
    -- Add the column fresh
    ALTER TABLE profiles ADD COLUMN pricing_mode text DEFAULT 'warehouse'
      CHECK (pricing_mode IS NULL OR pricing_mode IN ('warehouse', 'zone', 'type'));
  END IF;
END $$;

-- Type-based pricing settings (courier only)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS time_specific_price numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS out_of_zone_base numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS out_of_zone_per_km numeric(10,2) DEFAULT 0.50;

-- Client default service type
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.pricing_mode IS 'Pricing mode: warehouse, zone (distance-based) or type (type-based)';
COMMENT ON COLUMN profiles.time_specific_price IS 'Fixed price for services with time preference (type-based mode)';
COMMENT ON COLUMN profiles.out_of_zone_base IS 'Base price for out-of-zone services (type-based mode)';
COMMENT ON COLUMN profiles.out_of_zone_per_km IS 'Per-km rate for out-of-zone services (type-based mode)';
COMMENT ON COLUMN profiles.default_service_type_id IS 'Client default service type for new services';
