-- Migration: 028_pricing_display_settings
-- Remove obsolete column, add visibility settings

-- Remove obsolete column
ALTER TABLE profiles DROP COLUMN IF EXISTS auto_calculate_price;

-- Add display visibility settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_price_to_courier boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_price_to_client boolean DEFAULT true;

-- Track price overrides
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_override_reason text;

-- Comments for documentation
COMMENT ON COLUMN profiles.show_price_to_courier IS 'Whether courier sees price previews in UI';
COMMENT ON COLUMN profiles.show_price_to_client IS 'Whether client sees price previews in UI';
COMMENT ON COLUMN services.price_override_reason IS 'Reason for manual price override';
