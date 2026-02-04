-- Create missing RPC functions for reschedule workflow
-- These are called by the application but don't exist in the database

-- 1. reschedule_service: Called by courier to reschedule a service directly
-- Creates notification for client and records history
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

  -- Get current service state
  SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
  INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND deleted_at IS NULL;

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

  -- Update the service
  UPDATE public.services
  SET
    scheduled_date = p_new_date,
    scheduled_time_slot = p_new_time_slot,
    scheduled_time = p_new_time,
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
  RETURN jsonb_build_object(
    'success', false,
    'error', 'An internal error occurred. Please try again.'
  );
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION reschedule_service(uuid, date, text, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION reschedule_service IS 'Courier reschedules a service directly. Creates notification for client and records history.';


-- 2. client_approve_reschedule: Called by client to approve courier's suggested reschedule
CREATE OR REPLACE FUNCTION client_approve_reschedule(
  p_service_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_service record;
BEGIN
  -- Get the authenticated user ID
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get service and verify ownership (with lock to prevent race conditions)
  SELECT id, client_id, request_status, suggested_date, suggested_time_slot,
         scheduled_date, scheduled_time_slot
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

  -- Verify client owns this service
  IF v_service.client_id != v_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - not your service'
    );
  END IF;

  -- Verify there's a pending suggestion
  IF v_service.request_status != 'suggested' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending reschedule suggestion'
    );
  END IF;

  IF v_service.suggested_date IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No suggested date found'
    );
  END IF;

  -- Insert history record before update
  INSERT INTO public.service_reschedule_history (
    service_id,
    initiated_by,
    initiated_by_role,
    old_date,
    old_time_slot,
    new_date,
    new_time_slot,
    reason,
    approval_status,
    approved_by,
    approved_at
  ) VALUES (
    p_service_id,
    v_user_id,
    'client',
    v_service.scheduled_date,
    v_service.scheduled_time_slot,
    v_service.suggested_date,
    v_service.suggested_time_slot,
    'Client approved courier suggestion',
    'approved',
    v_user_id,
    NOW()
  );

  -- Apply the suggested schedule and clear suggestion fields
  UPDATE public.services
  SET
    scheduled_date = suggested_date,
    scheduled_time_slot = suggested_time_slot,
    suggested_date = NULL,
    suggested_time_slot = NULL,
    request_status = 'accepted',
    reschedule_count = COALESCE(reschedule_count, 0) + 1,
    last_rescheduled_at = NOW(),
    last_rescheduled_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_service_id;

  RETURN jsonb_build_object(
    'success', true
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'An internal error occurred. Please try again.'
  );
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION client_approve_reschedule(uuid) TO authenticated;

COMMENT ON FUNCTION client_approve_reschedule IS 'Client approves a courier-suggested reschedule. Applies suggested date/time as scheduled.';


-- 3. client_deny_reschedule: Called by client to deny courier's suggested reschedule
CREATE OR REPLACE FUNCTION client_deny_reschedule(
  p_service_id uuid,
  p_denial_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_service record;
BEGIN
  -- Get the authenticated user ID
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get service and verify ownership (with lock to prevent race conditions)
  SELECT id, client_id, request_status, suggested_date, suggested_time_slot,
         scheduled_date, scheduled_time_slot
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

  -- Verify client owns this service
  IF v_service.client_id != v_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - not your service'
    );
  END IF;

  -- Verify there's a pending suggestion
  IF v_service.request_status != 'suggested' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending reschedule suggestion'
    );
  END IF;

  -- Insert history record
  INSERT INTO public.service_reschedule_history (
    service_id,
    initiated_by,
    initiated_by_role,
    old_date,
    old_time_slot,
    new_date,
    new_time_slot,
    reason,
    approval_status,
    approved_by,
    approved_at,
    denial_reason
  ) VALUES (
    p_service_id,
    v_user_id,
    'client',
    v_service.scheduled_date,
    v_service.scheduled_time_slot,
    v_service.suggested_date,
    v_service.suggested_time_slot,
    'Client denied courier suggestion',
    'denied',
    v_user_id,
    NOW(),
    p_denial_reason
  );

  -- Clear suggestion fields but keep original schedule
  UPDATE public.services
  SET
    suggested_date = NULL,
    suggested_time_slot = NULL,
    request_status = 'accepted',  -- Revert to accepted (original schedule stands)
    updated_at = NOW()
  WHERE id = p_service_id;

  RETURN jsonb_build_object(
    'success', true
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'An internal error occurred. Please try again.'
  );
END;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION client_deny_reschedule(uuid, text) TO authenticated;

COMMENT ON FUNCTION client_deny_reschedule IS 'Client denies a courier-suggested reschedule. Clears suggestion, keeps original schedule.';
