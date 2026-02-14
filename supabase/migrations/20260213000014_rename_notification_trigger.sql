-- Standardize trigger naming: drop trg_ prefix for consistency
-- with other triggers (check_client_profile_update, check_client_service_update, etc.)
ALTER TRIGGER trg_check_notification_update_fields
  ON public.notifications
  RENAME TO check_notification_update_fields;
