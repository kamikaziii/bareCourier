---
status: pending
priority: p1
issue_id: "343"
tags: [security, database, triggers, code-review]
dependencies: []
---

# Two-step request_status downgrade attack in services trigger

## Problem Statement

The services trigger allows a client to perform a two-step attack to modify fields that should be immutable on non-pending services. A client can UPDATE `request_status` from 'accepted' back to 'pending' (the trigger allows it and RLS WITH CHECK doesn't constrain it), then in a second UPDATE modify ANY field (delivery_location, distance_km, tolls, etc.) because the trigger's pending check at line 92 does `RETURN NEW`, bypassing all field restrictions.

This is a critical security vulnerability that allows clients to tamper with accepted service parameters.

## Findings

- **Location**: `supabase/migrations/20260213000004_fix_services_trigger_denylist_and_ordering.sql`
- **Attack vector**: Two-step process:
  1. `UPDATE services SET request_status = 'pending' WHERE id = ?` (trigger allows, RLS doesn't block)
  2. `UPDATE services SET delivery_location = 'attacker address', distance_km = 0 WHERE id = ?` (trigger sees status as pending, returns NEW)
- **Root cause**: No state-machine validation on `request_status` transitions for client role
- **Impact**: Client can modify pricing, locations, distances, and other critical fields on already-accepted services

## Proposed Solutions

### Option 1: Add state-machine validation for client request_status transitions (Recommended)
Add explicit validation that clients can only transition `request_status` from 'suggested' to 'accepted' or 'declined'. Block all other client-initiated `request_status` changes on non-pending services.

```sql
-- After role check, before pending bypass
IF NOT is_courier THEN
  IF NEW.request_status IS DISTINCT FROM OLD.request_status THEN
    -- Clients may only: suggested → accepted, suggested → declined
    IF NOT (OLD.request_status = 'suggested' AND NEW.request_status IN ('accepted', 'declined')) THEN
      RAISE EXCEPTION 'clients cannot change request_status from % to %', OLD.request_status, NEW.request_status;
    END IF;
  END IF;
END IF;
```

- **Pros**: Closes the attack vector completely, enforces proper state machine
- **Cons**: Must ensure all legitimate client transitions are accounted for
- **Effort**: Small
- **Risk**: Low (well-defined state transitions)

### Option 2: Add RLS WITH CHECK constraint on request_status
Add a WITH CHECK policy that prevents clients from setting request_status to 'pending' on non-pending services.
- **Pros**: Defense at RLS layer
- **Cons**: RLS policies are harder to reason about; trigger-level fix is more explicit
- **Effort**: Small
- **Risk**: Medium (RLS interactions can be subtle)

## Recommended Action
<!-- Filled during triage -->

## Technical Details

- **Affected Files**: `supabase/migrations/20260213000004_fix_services_trigger_denylist_and_ordering.sql`
- **Related Components**: Services trigger, client service updates, request negotiation flow
- **Database Changes**: Yes — new migration to add state-machine validation to services trigger

## Acceptance Criteria

- [ ] Client cannot change request_status from 'accepted' to 'pending'
- [ ] Client cannot change request_status from 'accepted' to any value other than what's explicitly allowed
- [ ] Client can still transition request_status from 'suggested' to 'accepted' or 'declined'
- [ ] Courier can still change request_status freely
- [ ] E2E tests for request acceptance and negotiation still pass

## Work Log

### 2026-02-14 - Discovered during PR #21 security review
**By:** Claude Code Review
**Actions:** Created todo from PR #21 code review findings.
