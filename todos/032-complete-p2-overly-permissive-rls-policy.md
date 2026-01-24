# Overly Permissive RLS Policy for Client Updates

---
status: complete
priority: p2
issue_id: "032"
tags: [security, rls, database]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `supabase/migrations/019_add_client_update_policy.sql:8-19`
**Source**: security-sentinel, data-integrity-guardian, data-migration-expert (all flagged)

## Issue

RLS policy allows clients to update ANY field on services with `request_status IN ('pending', 'suggested')`. Clients could potentially modify:
- `calculated_price`
- `pickup_location`, `delivery_location`
- `notes`
- Other sensitive fields

## Expected Behavior

Clients should only be able to update:
- `request_status` (to accept/decline suggestions)
- `deleted_at` (for soft-delete/cancellation)

## Fix

Create column-restricted policy. Example approach:

```sql
-- Option 1: BEFORE UPDATE trigger to prevent field changes
CREATE OR REPLACE FUNCTION check_client_update_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.calculated_price <> OLD.calculated_price
     OR NEW.pickup_location <> OLD.pickup_location THEN
    RAISE EXCEPTION 'Clients cannot modify these fields';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Or use application-level validation before update.

## Verification

Test as client: attempt to modify `calculated_price` on pending service - should fail.

## Acceptance Criteria

- [x] Clients cannot modify calculated_price
- [x] Clients cannot modify pickup/delivery locations
- [x] Clients CAN still update request_status and deleted_at

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by 3 agents | RLS WITH CHECK needs column restrictions |
| 2026-01-24 | Approved during triage | Status changed to ready |
| 2026-01-24 | Implemented via migration 023 | BEFORE UPDATE trigger with SECURITY DEFINER checks user role and restricts field changes for clients |

## Resolution

Created migration `023_restrict_client_service_updates.sql` which adds:
1. A `check_client_service_update_fields()` trigger function that:
   - Checks the user's role from profiles table
   - Allows couriers to update any field
   - Restricts clients to only modify: `request_status`, `deleted_at`, `requested_date`, `requested_time_slot`
   - Uses `IS DISTINCT FROM` for proper NULL handling
2. A `BEFORE UPDATE` trigger on the services table

The function uses `SECURITY DEFINER` with `SET search_path = public` for security best practices.
