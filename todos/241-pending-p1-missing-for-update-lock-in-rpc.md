---
status: pending
priority: p1
issue_id: "241"
tags: [code-review, race-condition, database, pr-13]
dependencies: []
---

# Missing FOR UPDATE Lock in client_approve_reschedule RPC

## Problem Statement

The `client_approve_reschedule` RPC function does not lock the service row before reading and updating it, creating a race condition where concurrent requests could both succeed and cause data inconsistency.

## Findings

**Source:** data-integrity-guardian agent

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql` lines 176-181

**Current code (missing lock):**
```sql
SELECT id, client_id, request_status, suggested_date, suggested_time_slot,
       scheduled_date, scheduled_time_slot
INTO v_service
FROM public.services
WHERE id = p_service_id
  AND deleted_at IS NULL;  -- NO FOR UPDATE!
```

**Existing approve_reschedule function (correct pattern):**
```sql
SELECT ... INTO v_service FROM public.services
WHERE id = p_service_id FOR UPDATE;  -- Has the lock
```

**Impact:**
- Two concurrent approve requests could both read state as 'suggested'
- Both would insert history records (duplicate)
- Both would increment `reschedule_count` (double increment)
- Last write wins, potentially inconsistent state

## Proposed Solutions

### Solution 1: Add FOR UPDATE Lock (Recommended)
**Pros:** Simple fix, matches existing pattern
**Cons:** None
**Effort:** Small
**Risk:** Low

```sql
SELECT id, client_id, request_status, suggested_date, suggested_time_slot,
       scheduled_date, scheduled_time_slot
INTO v_service
FROM public.services
WHERE id = p_service_id
  AND deleted_at IS NULL
FOR UPDATE;  -- Add this
```

### Solution 2: Add FOR UPDATE to All Three New RPCs
**Pros:** Comprehensive fix
**Cons:** Slightly more work
**Effort:** Small
**Risk:** Low

Apply to:
- `client_approve_reschedule`
- `client_deny_reschedule`
- `reschedule_service` (already has proper checks but adding FOR UPDATE is safer)

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Functions to Update:**
- `client_approve_reschedule` (critical)
- `client_deny_reschedule` (should also add)

## Acceptance Criteria

- [ ] FOR UPDATE added to SELECT statement
- [ ] Concurrent requests don't create duplicate history
- [ ] Concurrent requests don't double-increment counters
- [ ] Test with concurrent requests shows proper serialization

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Existing RPCs use FOR UPDATE pattern |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- PostgreSQL Locking: https://www.postgresql.org/docs/current/explicit-locking.html
