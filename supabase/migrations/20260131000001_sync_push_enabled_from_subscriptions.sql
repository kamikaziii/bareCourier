-- Synchronize push_notifications_enabled based on existing push_subscriptions
-- This fixes users who subscribed to push before the profile flag was being set

-- Enable push notifications for users who have active push subscriptions
UPDATE profiles
SET push_notifications_enabled = true
WHERE id IN (
  SELECT DISTINCT user_id
  FROM push_subscriptions
)
AND (push_notifications_enabled IS NULL OR push_notifications_enabled = false);

-- Add helpful comment for future reference
COMMENT ON COLUMN profiles.push_notifications_enabled IS
  'Controls whether push notifications are sent. Automatically set when user subscribes/unsubscribes via push.ts service.';
