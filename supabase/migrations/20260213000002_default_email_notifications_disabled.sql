-- Default email notifications to disabled (opt-in instead of opt-out).
-- Existing users who already have email_notifications_enabled = true keep it.
-- New users will get false by default and must enable it in settings.

ALTER TABLE profiles
  ALTER COLUMN email_notifications_enabled SET DEFAULT false;
