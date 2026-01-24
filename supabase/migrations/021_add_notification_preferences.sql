-- Add notification preference columns to profiles table
-- Applied via MCP: 2026-01-24

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN profiles.push_notifications_enabled IS 'Whether user receives push notifications';
COMMENT ON COLUMN profiles.email_notifications_enabled IS 'Whether user receives email notifications';
