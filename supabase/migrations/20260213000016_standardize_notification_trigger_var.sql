-- Standardize variable naming in notification trigger function.
-- Convention: trigger functions use `user_role`, RPC functions use `v_user_role`.
-- The notification trigger was the only outlier using `_role`.

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
