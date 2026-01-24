# Overly Permissive RLS Policy for Client Updates

---
status: ready
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

- [ ] Clients cannot modify calculated_price
- [ ] Clients cannot modify pickup/delivery locations
- [ ] Clients CAN still update request_status and deleted_at

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by 3 agents | RLS WITH CHECK needs column restrictions |
| 2026-01-24 | Approved during triage | Status changed to ready |
