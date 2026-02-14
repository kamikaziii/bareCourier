-- Fix: Add FOR UPDATE row locking to bulk_reschedule_services
-- The individual reschedule_service function already uses FOR UPDATE when selecting
-- the service row, but bulk_reschedule_services was capturing state into a temp table
-- without locking. This creates a race condition where concurrent modifications could
-- occur between reading the old state and performing the update.
-- Fix: Add a PERFORM ... FOR UPDATE before the INSERT INTO temp_services_to_update
-- to lock the rows first.

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

  -- Lock rows first to prevent concurrent modifications
  PERFORM 1 FROM public.services
  WHERE id = ANY(p_service_ids)
    AND status = 'pending'
  FOR UPDATE;

  -- Capture current state (rows are now locked)
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

COMMENT ON FUNCTION bulk_reschedule_services IS 'Bulk reschedule services atomically. SECURITY: Always uses auth.uid(). Fixed: FOR UPDATE row locking, explicit ::time cast, and proper exception propagation.';
