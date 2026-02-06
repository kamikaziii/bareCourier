-- Fix #277: reschedule_service & bulk_reschedule_services p_new_time type mismatch
-- The p_new_time parameter in reschedule_service is text but scheduled_time column
-- is time without time zone. Add explicit ::time cast to prevent implicit conversion errors.
--
-- Fix #281: bulk_reschedule_services swallows exceptions
-- The EXCEPTION WHEN OTHERS handler was catching all errors and returning JSON with SQLERRM
-- instead of propagating. This caused partial commits when later operations failed.
-- Apply the same RAISE WARNING + RAISE pattern used in migration 20260205000002.

-- 1. Fix reschedule_service: add ::time cast for p_new_time
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
  -- Get the authenticated user ID
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Verify user is courier
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'courier' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - courier role required'
    );
  END IF;

  -- Validate time slot
  IF p_new_time_slot NOT IN ('morning', 'afternoon', 'evening', 'specific') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid time slot. Must be: morning, afternoon, evening, or specific'
    );
  END IF;

  -- Get current service state (with lock to prevent race conditions)
  SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
  INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_service.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Service not found'
    );
  END IF;

  IF v_service.status != 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only reschedule pending services'
    );
  END IF;

  -- Store old values for history
  v_old_date := v_service.scheduled_date;
  v_old_time_slot := v_service.scheduled_time_slot;
  v_old_time := v_service.scheduled_time;

  -- Update the service (FIX #277: explicit ::time cast for p_new_time)
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

  -- Insert history record
  INSERT INTO public.service_reschedule_history (
    service_id,
    initiated_by,
    initiated_by_role,
    old_date,
    old_time_slot,
    old_time,
    new_date,
    new_time_slot,
    new_time,
    reason,
    approval_status
  ) VALUES (
    p_service_id,
    v_user_id,
    'courier',
    v_old_date,
    v_old_time_slot,
    v_old_time,
    p_new_date,
    p_new_time_slot,
    p_new_time,
    p_reason,
    'auto_approved'
  );

  -- Create notification for client
  IF p_notification_title IS NOT NULL AND p_notification_message IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      service_id
    ) VALUES (
      v_service.client_id,
      'schedule_change',
      p_notification_title,
      p_notification_message,
      p_service_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_service.client_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RAISE;  -- Re-raise to trigger proper rollback
END;
$$;

COMMENT ON FUNCTION reschedule_service(uuid, date, text, text, text, text, text) IS 'Courier reschedules a service directly. Fixed: explicit ::time cast for p_new_time parameter.';


-- 2. Fix bulk_reschedule_services: add ::time cast AND fix exception handler
CREATE OR REPLACE FUNCTION bulk_reschedule_services(
  p_service_ids uuid[],
  p_new_date date,
  p_new_time_slot text,
  p_new_time time DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL  -- Keep parameter for API compatibility but IGNORE it
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_updated_count integer := 0;
  v_client_notifications jsonb := '[]'::jsonb;
BEGIN
  -- SECURITY FIX: Always use auth.uid(), NEVER trust p_user_id parameter
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated',
      'updated_count', 0
    );
  END IF;

  -- Verify user is courier
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'courier' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - courier role required',
      'updated_count', 0
    );
  END IF;

  -- Validate inputs
  IF array_length(p_service_ids, 1) IS NULL OR array_length(p_service_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No service IDs provided',
      'updated_count', 0
    );
  END IF;

  IF p_new_date IS NULL OR p_new_time_slot IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Date and time slot are required',
      'updated_count', 0
    );
  END IF;

  -- Create temp table for history
  CREATE TEMP TABLE IF NOT EXISTS temp_services_to_update (
    id uuid,
    client_id uuid,
    old_date date,
    old_time_slot text,
    old_time time
  ) ON COMMIT DROP;

  TRUNCATE temp_services_to_update;

  -- Capture current state
  INSERT INTO temp_services_to_update (id, client_id, old_date, old_time_slot, old_time)
  SELECT s.id, s.client_id, s.scheduled_date, s.scheduled_time_slot, s.scheduled_time
  FROM public.services s
  WHERE s.id = ANY(p_service_ids)
    AND s.status = 'pending';

  -- Bulk update (FIX #277: explicit ::time cast for p_new_time)
  UPDATE public.services
  SET
    scheduled_date = p_new_date,
    scheduled_time_slot = p_new_time_slot,
    scheduled_time = p_new_time::time,
    reschedule_count = COALESCE(reschedule_count, 0) + 1,
    last_rescheduled_at = NOW(),
    last_rescheduled_by = v_user_id,
    updated_at = NOW()
  WHERE id = ANY(p_service_ids)
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Insert history records
  INSERT INTO public.service_reschedule_history (
    service_id, initiated_by, initiated_by_role,
    old_date, old_time_slot, old_time,
    new_date, new_time_slot, new_time,
    reason, approval_status
  )
  SELECT
    t.id, v_user_id, 'courier',
    t.old_date, t.old_time_slot, t.old_time::text,
    p_new_date, p_new_time_slot, p_new_time::text,
    COALESCE(p_reason, 'Batch reschedule'), 'auto_approved'
  FROM temp_services_to_update t;

  -- Aggregate notifications
  SELECT jsonb_agg(
    jsonb_build_object('client_id', client_id, 'service_ids', service_ids)
  )
  INTO v_client_notifications
  FROM (
    SELECT t.client_id, jsonb_agg(t.id) as service_ids
    FROM temp_services_to_update t
    GROUP BY t.client_id
  ) grouped;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'client_notifications', COALESCE(v_client_notifications, '[]'::jsonb)
  );

-- FIX #281: Re-raise exceptions instead of swallowing them
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RAISE;  -- Re-raise to trigger proper rollback
END;
$$;

COMMENT ON FUNCTION bulk_reschedule_services IS 'Bulk reschedule services atomically. SECURITY: Always uses auth.uid(). Fixed: explicit ::time cast and proper exception propagation.';
