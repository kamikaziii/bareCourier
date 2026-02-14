-- Fix approve_reschedule and deny_reschedule to use server-derived auth.uid()
-- instead of caller-supplied parameters for audit trail fields.
-- This prevents clients from spoofing the approved_by/denied_by identity.

-- Drop old signatures first (parameter changes create new overloads)
DROP FUNCTION IF EXISTS approve_reschedule(uuid, uuid);
DROP FUNCTION IF EXISTS deny_reschedule(uuid, uuid, text);

-- Recreate approve_reschedule without p_approved_by parameter
CREATE OR REPLACE FUNCTION approve_reschedule(
  p_service_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_service RECORD;
  v_client_id uuid;
  v_updated_count int;
BEGIN
  -- Authorization check: only couriers can approve reschedules
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

  -- Get the service with pending reschedule
  SELECT
    client_id,
    pending_reschedule_date,
    pending_reschedule_time_slot,
    pending_reschedule_time,
    pending_reschedule_requested_by,
    reschedule_count
  INTO v_service
  FROM public.services
  WHERE id = p_service_id
  FOR UPDATE;

  IF v_service IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Service not found');
  END IF;

  IF v_service.pending_reschedule_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending reschedule request');
  END IF;

  v_client_id := v_service.client_id;

  -- Update the service: apply reschedule and clear pending fields
  UPDATE public.services
  SET
    scheduled_date = v_service.pending_reschedule_date,
    scheduled_time_slot = v_service.pending_reschedule_time_slot,
    scheduled_time = v_service.pending_reschedule_time::time,
    reschedule_count = COALESCE(v_service.reschedule_count, 0) + 1,
    last_rescheduled_at = now(),
    last_rescheduled_by = v_service.pending_reschedule_requested_by,
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

  -- Update the reschedule history record (use v_user_id from auth.uid())
  UPDATE public.service_reschedule_history
  SET
    approval_status = 'approved',
    approved_by = v_user_id,
    approved_at = now()
  WHERE service_id = p_service_id
    AND approval_status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id
  );
END;
$$;

COMMENT ON FUNCTION approve_reschedule IS 'Approves a pending reschedule request. Requires courier role. Uses auth.uid() for audit trail.';

-- Recreate deny_reschedule without p_denied_by parameter
CREATE OR REPLACE FUNCTION deny_reschedule(
  p_service_id uuid,
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

  -- Update the reschedule history record (use v_user_id from auth.uid())
  UPDATE public.service_reschedule_history
  SET
    approval_status = 'denied',
    approved_by = v_user_id,
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

COMMENT ON FUNCTION deny_reschedule IS 'Denies a pending reschedule request. Requires courier role. Uses auth.uid() for audit trail.';
