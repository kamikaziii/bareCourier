-- Fix deny_reschedule to add courier authorization check
CREATE OR REPLACE FUNCTION deny_reschedule(
  p_service_id uuid,
  p_denied_by uuid,
  p_denial_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_client_id uuid;
  v_has_pending boolean;
  v_updated_count int;
BEGIN
  -- Authorization check: only couriers can deny reschedules
  v_user_id := (SELECT auth.uid());

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role != 'courier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized - courier role required');
  END IF;

  -- Get the service and check for pending reschedule
  SELECT
    client_id,
    pending_reschedule_date IS NOT NULL
  INTO v_client_id, v_has_pending
  FROM public.services
  WHERE id = p_service_id
  FOR UPDATE;

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service not found');
  END IF;

  IF NOT v_has_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending reschedule request');
  END IF;

  -- Clear pending reschedule fields from service
  UPDATE public.services
  SET
    pending_reschedule_date = NULL,
    pending_reschedule_time_slot = NULL,
    pending_reschedule_time = NULL,
    pending_reschedule_reason = NULL,
    pending_reschedule_requested_at = NULL,
    pending_reschedule_requested_by = NULL,
    updated_at = now()
  WHERE id = p_service_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Failed to update service');
  END IF;

  -- Update the reschedule history record
  UPDATE public.service_reschedule_history
  SET
    approval_status = 'denied',
    approved_by = p_denied_by,
    approved_at = now(),
    denial_reason = p_denial_reason
  WHERE service_id = p_service_id
    AND approval_status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id
  );
END;
$$;

COMMENT ON FUNCTION deny_reschedule IS 'Denies a pending reschedule request. Requires courier role.';
