---
status: pending
priority: p1
issue_id: "252"
tags: [code-review, race-condition, database, pr-13]
dependencies: []
---

# Missing FOR UPDATE Lock in reschedule_service RPC

## Problem Statement

The `reschedule_service` RPC function does not lock the service row before reading and updating it, creating a race condition where concurrent operations could cause data inconsistency.

While `client_approve_reschedule` (line 190) and `client_deny_reschedule` (line 313) both have `FOR UPDATE` locks, the `reschedule_service` function does not.

## Findings

**Source:** Manual code review of PR #13

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql` lines 59-63

**Current code (missing lock):**
```sql
SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
INTO v_service
FROM public.services
WHERE id = p_service_id
  AND deleted_at IS NULL;
-- NO FOR UPDATE!
```

**Existing correct pattern in same file:**
```sql
-- client_approve_reschedule (line 184-190)
SELECT ... INTO v_service FROM public.services
WHERE id = p_service_id
  AND deleted_at IS NULL
FOR UPDATE;  -- Has the lock
```

**Race Condition Scenario:**
1. Courier calls `reschedule_service` (reads service without lock)
2. Simultaneously, client calls `client_approve_reschedule` on same service
3. Both read `reschedule_count = 2`
4. Both increment and write `reschedule_count = 3`
5. Final value is 3 instead of 4 (lost update)
6. Both create history records (duplicates)

**Impact:**
- Lost updates to `reschedule_count`
- Duplicate history records
- Inconsistent service state

## Proposed Solutions

### Solution 1: Add FOR UPDATE Lock (Recommended)
**Pros:** Simple fix, matches existing pattern in same file
**Cons:** None
**Effort:** Small
**Risk:** Low

```sql
SELECT id, client_id, scheduled_date, scheduled_time_slot, scheduled_time, status
INTO v_service
FROM public.services
WHERE id = p_service_id
  AND deleted_at IS NULL
FOR UPDATE;  -- Add this
```

### Solution 2: Use SKIP LOCKED for Non-Blocking
**Pros:** Non-blocking if row is locked
**Cons:** Would need error handling for skipped rows
**Effort:** Medium
**Risk:** Low

```sql
FOR UPDATE SKIP LOCKED;
-- Return error if no row returned (was locked)
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Function:** `reschedule_service(uuid, date, text, text, text, text, text)`

**Fix requires:** New migration to replace function

## Acceptance Criteria

- [ ] FOR UPDATE added to SELECT statement in reschedule_service
- [ ] New migration created (don't modify existing migration)
- [ ] Concurrent requests properly serialize
- [ ] Test with concurrent courier and client operations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Other RPCs in same file use FOR UPDATE correctly |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- PostgreSQL Locking: https://www.postgresql.org/docs/current/explicit-locking.html
- Related finding #241 (covered client RPCs, missed this one)
