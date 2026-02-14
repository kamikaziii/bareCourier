-- Migration: Restrict which notification fields clients can update
-- Problem: The UPDATE RLS policy lets users modify ANY field on their own notifications.
-- Solution: A BEFORE UPDATE trigger that only allows clients to change `read` and `dismissed_at`.

CREATE OR REPLACE FUNCTION public.check_notification_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  -- Couriers can update anything
  IF user_role = 'courier' THEN
    RETURN NEW;
  END IF;

  -- For all other users, block modifications to protected fields
  IF NEW.email_id IS DISTINCT FROM OLD.email_id THEN
    RAISE EXCEPTION 'You are not allowed to modify email_id';
  END IF;

  IF NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at THEN
    RAISE EXCEPTION 'You are not allowed to modify email_sent_at';
  END IF;

  IF NEW.email_status IS DISTINCT FROM OLD.email_status THEN
    RAISE EXCEPTION 'You are not allowed to modify email_status';
  END IF;

  IF NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'You are not allowed to modify type';
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'You are not allowed to modify title';
  END IF;

  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'You are not allowed to modify message';
  END IF;

  IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN
    RAISE EXCEPTION 'You are not allowed to modify service_id';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'You are not allowed to modify user_id';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'You are not allowed to modify created_at';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'You are not allowed to modify id';
  END IF;

  -- Only `read` and `dismissed_at` modifications reach here
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_notification_update_fields()
IS 'Restricts non-courier users to only updating read and dismissed_at on their notifications.';

CREATE TRIGGER check_notification_update_fields
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.check_notification_update_fields();
