-- Fix duplicate reschedule_service function overload in the DB.
-- The CREATE OR REPLACE in migration 20260206000004 created a second overload
-- instead of replacing the existing one (different parameter type for p_new_time).
-- Drop the old signature (from 20260205000002) so only the fixed one remains.

-- The old function had: p_new_time text DEFAULT NULL (declared in 20260205000002)
-- The new function also has: p_new_time text DEFAULT NULL (same signature, but CREATE OR REPLACE
-- may have registered a second entry if Postgres saw them as distinct).
--
-- To be safe, drop ALL overloads and recreate the correct one.

-- Drop all overloads
DROP FUNCTION IF EXISTS reschedule_service(uuid, date, text, text, text, text, text);

-- Recreate the single correct version (copied from 20260206000004 with ::time fix)
CREATE OR REPLACE FUNCTION reschedule_service(
  p_service_id uuid,
  p_new_date date,
  p_new_time_slot text,
  p_new_time text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_notification_title text DEFAULT NULL,
  p_notification_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_service record;
  v_old_date date;
  v_old_time_slot text;
  v_old_time text;
BEGIN
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'courier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - courier role required');
  END IF;

  IF p_new_time_slot NOT IN ('morning', 'afternoon', 'evening', 'specific') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid time slot. Must be: morning, afternoon, evening, or specific');
  END IF;

  SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
  INTO v_service
  FROM public.services
  WHERE id = p_service_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_service.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service not found');
  END IF;

  IF v_service.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only reschedule pending services');
  END IF;

  v_old_date := v_service.scheduled_date;
  v_old_time_slot := v_service.scheduled_time_slot;
  v_old_time := v_service.scheduled_time;

  UPDATE public.services
  SET
    scheduled_date = p_new_date,
    scheduled_time_slot = p_new_time_slot,
    scheduled_time = p_new_time::time,
    reschedule_count = COALESCE(reschedule_count, 0) + 1,
    last_rescheduled_at = NOW(),
    last_rescheduled_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_service_id;

  INSERT INTO public.service_reschedule_history (
    service_id, initiated_by, initiated_by_role,
    old_date, old_time_slot, old_time,
    new_date, new_time_slot, new_time,
    reason, approval_status
  ) VALUES (
    p_service_id, v_user_id, 'courier',
    v_old_date, v_old_time_slot, v_old_time,
    p_new_date, p_new_time_slot, p_new_time,
    p_reason, 'auto_approved'
  );

  IF p_notification_title IS NOT NULL AND p_notification_message IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, service_id)
    VALUES (v_service.client_id, 'schedule_change', p_notification_title, p_notification_message, p_service_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'client_id', v_service.client_id);

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RAISE;
END;
$$;
