-- Add pricing_mode to profiles (for courier only)
-- This controls HOW distance is calculated, not the rate structure
-- - 'warehouse': Distance from courier's base location to pickup, plus pickup to delivery
-- - 'zone': Fixed prices per geographic zone, regardless of actual distance

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'warehouse';

-- Add check constraint
ALTER TABLE profiles
ADD CONSTRAINT profiles_pricing_mode_check
CHECK (pricing_mode IS NULL OR pricing_mode IN ('warehouse', 'zone'));

-- Add documentation comment
COMMENT ON COLUMN profiles.pricing_mode IS
  'Distance calculation mode for courier pricing. warehouse=from base location, zone=fixed per zone. Only used by courier role.';
