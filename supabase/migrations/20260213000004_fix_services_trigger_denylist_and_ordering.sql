-- Combined fix: Denylist gaps + field ordering regression
--
-- Issue 1 (Todo 306): The trigger only blocked ~18 of 55 fields. Many
-- security-sensitive fields (service_type_id, tolls, recipient_name/phone,
-- customer_reference, zone detection, reschedule audit fields, etc.) were
-- unprotected on non-pending services.
--
-- Issue 2 (Todo 307): Migration 20260213000001 placed scheduled_date,
-- scheduled_time_slot, suggested_date, suggested_time_slot in the
-- "always blocked" section BEFORE the suggestion bypass. This made
-- the bypass dead code, breaking client_approve_reschedule() and
-- client_deny_reschedule() RPCs. Migration 20260207000001 had the
-- correct ordering (bypass BEFORE scheduling fields).
--
-- This migration rewrites the trigger with:
--   - All 54 columns accounted for (explicitly blocked or allowed)
--   - Column count assertion (54) to detect schema drift
--   - State-machine validation on client request_status transitions
--   - Correct control flow: suggestion bypass BEFORE scheduling fields
--   - Clear section comments for each group of fields

CREATE OR REPLACE FUNCTION check_client_service_update_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Get the user's role
  -- ----------------------------------------------------------------
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  -- ----------------------------------------------------------------
  -- 2. Couriers can update anything — skip all checks
  -- ----------------------------------------------------------------
  IF user_role = 'courier' THEN
    RETURN NEW;
  END IF;

  -- ================================================================
  -- CLIENT RESTRICTIONS (below applies to clients and unknown roles)
  -- Using IS DISTINCT FROM for NULL-safe comparisons throughout
  -- ================================================================

  -- ----------------------------------------------------------------
  -- 3. Column count safety check — if this fails, a column was
  --    added/removed from services without updating this trigger.
  --    Review the new column, add a check (to block) or to the
  --    allowed list, then bump this number.
  -- ----------------------------------------------------------------
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'services') != 54 THEN
    RAISE EXCEPTION 'services table has % columns (expected 54) — update check_client_service_update_fields trigger',
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services');
  END IF;

  -- ----------------------------------------------------------------
  -- 4. State-machine validation — clients can only transition
  --    request_status in allowed ways. This prevents the two-step
  --    downgrade attack: accepted→pending then modifying fields.
  -- ----------------------------------------------------------------
  IF NEW.request_status IS DISTINCT FROM OLD.request_status THEN
    -- Clients may only: suggested → accepted, suggested → declined
    IF NOT (OLD.request_status = 'suggested'
            AND NEW.request_status IN ('accepted', 'declined')) THEN
      RAISE EXCEPTION 'Clients cannot change request_status from % to %',
        OLD.request_status, NEW.request_status;
    END IF;
  END IF;

  -- ----------------------------------------------------------------
  -- 5. "Never modify" fields — clients can NEVER change these
  --    regardless of request_status
  -- ----------------------------------------------------------------
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Clients cannot modify id';
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Clients cannot modify client_id';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Clients cannot modify service status';
  END IF;

  IF NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'Clients cannot modify delivered_at';
  END IF;

  IF NEW.calculated_price IS DISTINCT FROM OLD.calculated_price THEN
    RAISE EXCEPTION 'Clients cannot modify calculated_price';
  END IF;

  IF NEW.price_breakdown IS DISTINCT FROM OLD.price_breakdown THEN
    RAISE EXCEPTION 'Clients cannot modify price_breakdown';
  END IF;

  IF NEW.display_id IS DISTINCT FROM OLD.display_id THEN
    RAISE EXCEPTION 'Clients cannot modify display_id';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Clients cannot modify created_at';
  END IF;

  IF NEW.vat_rate_snapshot IS DISTINCT FROM OLD.vat_rate_snapshot THEN
    RAISE EXCEPTION 'Clients cannot modify vat_rate_snapshot';
  END IF;

  IF NEW.prices_include_vat_snapshot IS DISTINCT FROM OLD.prices_include_vat_snapshot THEN
    RAISE EXCEPTION 'Clients cannot modify prices_include_vat_snapshot';
  END IF;

  -- ----------------------------------------------------------------
  -- 6. Pending check — if service is pending, allow editing
  --    locations, notes, coordinates, distance, urgency, etc.
  --    (request_status is already validated in step 4)
  -- ----------------------------------------------------------------
  IF OLD.request_status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- ----------------------------------------------------------------
  -- 7. Suggestion bypass — allow scheduling field changes when
  --    responding to a courier suggestion (suggested → accepted).
  --    This is CRITICAL for client_approve_reschedule() and
  --    client_deny_reschedule() RPCs to work.
  --    MUST come BEFORE scheduling field checks (step 8).
  -- ----------------------------------------------------------------
  IF OLD.request_status = 'suggested' AND NEW.request_status = 'accepted' THEN
    RETURN NEW;
  END IF;

  -- ----------------------------------------------------------------
  -- 8. Scheduling fields — blocked for non-pending,
  --    non-suggestion-response updates
  -- ----------------------------------------------------------------
  IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
    RAISE EXCEPTION 'Clients cannot modify scheduled_date on non-pending services';
  END IF;

  IF NEW.scheduled_time_slot IS DISTINCT FROM OLD.scheduled_time_slot THEN
    RAISE EXCEPTION 'Clients cannot modify scheduled_time_slot on non-pending services';
  END IF;

  IF NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN
    RAISE EXCEPTION 'Clients cannot modify scheduled_time on non-pending services';
  END IF;

  IF NEW.suggested_date IS DISTINCT FROM OLD.suggested_date THEN
    RAISE EXCEPTION 'Clients cannot modify suggested_date on non-pending services';
  END IF;

  IF NEW.suggested_time_slot IS DISTINCT FROM OLD.suggested_time_slot THEN
    RAISE EXCEPTION 'Clients cannot modify suggested_time_slot on non-pending services';
  END IF;

  IF NEW.suggested_time IS DISTINCT FROM OLD.suggested_time THEN
    RAISE EXCEPTION 'Clients cannot modify suggested_time on non-pending services';
  END IF;

  -- ----------------------------------------------------------------
  -- 9. Location/distance fields — blocked for non-pending
  -- ----------------------------------------------------------------
  IF NEW.pickup_location IS DISTINCT FROM OLD.pickup_location THEN
    RAISE EXCEPTION 'Clients cannot modify pickup_location on non-pending services';
  END IF;

  IF NEW.delivery_location IS DISTINCT FROM OLD.delivery_location THEN
    RAISE EXCEPTION 'Clients cannot modify delivery_location on non-pending services';
  END IF;

  IF NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng THEN
    RAISE EXCEPTION 'Clients cannot modify pickup coordinates on non-pending services';
  END IF;

  IF NEW.delivery_lat IS DISTINCT FROM OLD.delivery_lat
     OR NEW.delivery_lng IS DISTINCT FROM OLD.delivery_lng THEN
    RAISE EXCEPTION 'Clients cannot modify delivery coordinates on non-pending services';
  END IF;

  IF NEW.distance_km IS DISTINCT FROM OLD.distance_km THEN
    RAISE EXCEPTION 'Clients cannot modify distance_km on non-pending services';
  END IF;

  -- ----------------------------------------------------------------
  -- 10. Service data fields — blocked for non-pending
  -- ----------------------------------------------------------------
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Clients cannot modify notes on non-pending services';
  END IF;

  IF NEW.urgency_fee_id IS DISTINCT FROM OLD.urgency_fee_id THEN
    RAISE EXCEPTION 'Clients cannot modify urgency_fee_id on non-pending services';
  END IF;

  IF NEW.service_type_id IS DISTINCT FROM OLD.service_type_id THEN
    RAISE EXCEPTION 'Clients cannot modify service_type_id on non-pending services';
  END IF;

  IF NEW.tolls IS DISTINCT FROM OLD.tolls THEN
    RAISE EXCEPTION 'Clients cannot modify tolls on non-pending services';
  END IF;

  IF NEW.recipient_name IS DISTINCT FROM OLD.recipient_name THEN
    RAISE EXCEPTION 'Clients cannot modify recipient_name on non-pending services';
  END IF;

  IF NEW.recipient_phone IS DISTINCT FROM OLD.recipient_phone THEN
    RAISE EXCEPTION 'Clients cannot modify recipient_phone on non-pending services';
  END IF;

  IF NEW.customer_reference IS DISTINCT FROM OLD.customer_reference THEN
    RAISE EXCEPTION 'Clients cannot modify customer_reference on non-pending services';
  END IF;

  -- ----------------------------------------------------------------
  -- 11. Audit/system fields — blocked for non-pending
  -- ----------------------------------------------------------------
  IF NEW.is_out_of_zone IS DISTINCT FROM OLD.is_out_of_zone THEN
    RAISE EXCEPTION 'Clients cannot modify is_out_of_zone on non-pending services';
  END IF;

  IF NEW.pickup_is_out_of_zone IS DISTINCT FROM OLD.pickup_is_out_of_zone THEN
    RAISE EXCEPTION 'Clients cannot modify pickup_is_out_of_zone on non-pending services';
  END IF;

  IF NEW.detected_municipality IS DISTINCT FROM OLD.detected_municipality THEN
    RAISE EXCEPTION 'Clients cannot modify detected_municipality on non-pending services';
  END IF;

  IF NEW.pickup_detected_municipality IS DISTINCT FROM OLD.pickup_detected_municipality THEN
    RAISE EXCEPTION 'Clients cannot modify pickup_detected_municipality on non-pending services';
  END IF;

  IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    RAISE EXCEPTION 'Clients cannot modify duration_minutes on non-pending services';
  END IF;

  IF NEW.has_time_preference IS DISTINCT FROM OLD.has_time_preference THEN
    RAISE EXCEPTION 'Clients cannot modify has_time_preference on non-pending services';
  END IF;

  IF NEW.price_override_reason IS DISTINCT FROM OLD.price_override_reason THEN
    RAISE EXCEPTION 'Clients cannot modify price_override_reason on non-pending services';
  END IF;

  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Clients cannot modify rejection_reason on non-pending services';
  END IF;

  IF NEW.last_past_due_notification_at IS DISTINCT FROM OLD.last_past_due_notification_at THEN
    RAISE EXCEPTION 'Clients cannot modify last_past_due_notification_at on non-pending services';
  END IF;

  -- ----------------------------------------------------------------
  -- 12. Reschedule fields — blocked for non-pending (set via RPCs)
  -- ----------------------------------------------------------------
  IF NEW.reschedule_count IS DISTINCT FROM OLD.reschedule_count THEN
    RAISE EXCEPTION 'Clients cannot modify reschedule_count on non-pending services';
  END IF;

  IF NEW.last_rescheduled_at IS DISTINCT FROM OLD.last_rescheduled_at THEN
    RAISE EXCEPTION 'Clients cannot modify last_rescheduled_at on non-pending services';
  END IF;

  IF NEW.last_rescheduled_by IS DISTINCT FROM OLD.last_rescheduled_by THEN
    RAISE EXCEPTION 'Clients cannot modify last_rescheduled_by on non-pending services';
  END IF;

  IF NEW.pending_reschedule_date IS DISTINCT FROM OLD.pending_reschedule_date THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_date on non-pending services';
  END IF;

  IF NEW.pending_reschedule_time_slot IS DISTINCT FROM OLD.pending_reschedule_time_slot THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_time_slot on non-pending services';
  END IF;

  IF NEW.pending_reschedule_time IS DISTINCT FROM OLD.pending_reschedule_time THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_time on non-pending services';
  END IF;

  IF NEW.pending_reschedule_reason IS DISTINCT FROM OLD.pending_reschedule_reason THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_reason on non-pending services';
  END IF;

  IF NEW.pending_reschedule_requested_at IS DISTINCT FROM OLD.pending_reschedule_requested_at THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_requested_at on non-pending services';
  END IF;

  IF NEW.pending_reschedule_requested_by IS DISTINCT FROM OLD.pending_reschedule_requested_by THEN
    RAISE EXCEPTION 'Clients cannot modify pending_reschedule_requested_by on non-pending services';
  END IF;

  -- ----------------------------------------------------------------
  -- 13. Implicitly ALLOWED fields (not checked above):
  --   - request_status  (validated in step 4, not blocked)
  --   - deleted_at      (soft-delete/cancellation)
  --   - requested_date  (client's own schedule request)
  --   - requested_time  (client's own schedule request)
  --   - requested_time_slot (client's own schedule request)
  --   - updated_at      (timestamp housekeeping)
  -- ----------------------------------------------------------------

  -- ----------------------------------------------------------------
  -- 14. All checks passed — allow the update
  -- ----------------------------------------------------------------
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_client_service_update_fields() IS
  'Restricts which fields clients can modify on services. '
  'Column count assertion (54) ensures new columns fail loudly until this trigger is updated. '
  'State-machine validation restricts client request_status transitions to only '
  'suggested->accepted and suggested->declined, preventing the two-step downgrade attack. '
  'All 54 columns are accounted for: 10 are never-modify (id, client_id, status, '
  'delivered_at, calculated_price, price_breakdown, display_id, created_at, '
  'vat_rate_snapshot, prices_include_vat_snapshot). Pending services allow '
  'full editing. The suggestion bypass (suggested->accepted) allows '
  'client_approve_reschedule and client_deny_reschedule RPCs. For non-pending '
  'services, 38 additional fields are blocked across scheduling, location, '
  'service data, audit, and reschedule groups. 6 fields are always allowed: '
  'request_status (validated), deleted_at, requested_date/time/time_slot, updated_at. '
  'Uses SECURITY DEFINER with empty search_path for security.';
