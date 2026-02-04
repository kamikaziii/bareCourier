---
status: ready
priority: p2
issue_id: "261"
tags: [code-review, data-integrity, database, pr-13]
dependencies: []
---

# RPC Exception Handler Prevents Proper Transaction Rollback

## Problem Statement

The `reschedule_service` RPC function (and similar functions) catches all exceptions with `EXCEPTION WHEN OTHERS` and returns a JSON response instead of propagating the error. This causes partial commits when later operations fail.

**Why it matters:**
- Service updated but notification not created = data inconsistency
- History recorded but client never notified = silent failures
- Debugging difficult because transaction appears to succeed

## Findings

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql` (lines 145-151)
**Also in:** `supabase/migrations/20260205000001_fix_reschedule_service_for_update.sql` (same pattern)

```sql
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'An internal error occurred. Please try again.'
  );
END;
```

**Failure scenario:**
1. `UPDATE services` succeeds
2. `INSERT service_reschedule_history` succeeds
3. `INSERT notifications` fails (e.g., FK violation)
4. Exception caught → returns `{success: false}`
5. Transaction **COMMITS** with partial data (services + history updated, no notification)

## Proposed Solutions

### Option A: Remove exception handler, let errors propagate (Recommended)
**Pros:** Proper rollback on any failure, simpler code
**Cons:** Raw errors may reach client (mitigate with edge function error mapping)
**Effort:** Small
**Risk:** Low

```sql
-- Remove the EXCEPTION block entirely
-- PostgreSQL will automatically rollback on any error
```

### Option B: Use savepoints for partial rollback
**Pros:** Fine-grained control over which operations commit
**Cons:** More complex, overkill for this use case
**Effort:** Medium
**Risk:** Low

### Option C: Re-raise after logging
**Pros:** Keeps logging, ensures rollback
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Very Low

```sql
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RPC error: %', SQLERRM;
  RAISE;  -- Re-raise to trigger rollback
END;
```

## Recommended Action

Implement Option C for now (re-raise after logging) to maintain visibility while ensuring proper rollback. Consider Option A long-term if edge function error handling is robust.

## Technical Details

- **Affected migrations:**
  - `20260204000001_create_missing_reschedule_rpcs.sql`
  - `20260205000001_fix_reschedule_service_for_update.sql`
- **Functions to update:**
  - `reschedule_service`
  - `client_approve_reschedule`
  - `client_deny_reschedule`
- **Deployment:** Create new migration to replace functions

## Acceptance Criteria

- [ ] `reschedule_service` rolls back completely on any failure
- [ ] `client_approve_reschedule` rolls back completely on any failure
- [ ] `client_deny_reschedule` rolls back completely on any failure
- [ ] Errors are still logged for debugging
- [ ] Test: Simulate notification insert failure, verify service not updated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | EXCEPTION handlers need careful design |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- PostgreSQL Exception Handling: https://www.postgresql.org/docs/current/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING
