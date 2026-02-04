---
status: pending
priority: p1
issue_id: "216"
tags: [security, code-review, database, pr-13]
dependencies: []
---

# SQLERRM Information Disclosure in RPC Functions

## Problem Statement

The RPC functions in migration `20260204000001_create_missing_reschedule_rpcs.sql` expose internal database error messages to clients via `SQLERRM`. This can leak sensitive information about database schema, table names, constraints, and implementation details.

**Impact:** Security vulnerability - attackers can use error messages to understand database structure and craft targeted attacks.

## Findings

**Location:** `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

Lines 137-141, 257-261, 367-371:
```sql
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
```

This pattern exposes raw PostgreSQL error messages like:
- `"null value in column \"service_id\" violates not-null constraint"`
- `"duplicate key value violates unique constraint \"services_pkey\""`
- `"relation \"service_reschedule_history\" does not exist"`

## Proposed Solutions

### Option A: Generic Error Messages (Recommended)
Replace SQLERRM with generic error and log internally:

```sql
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'reschedule_service error for service %: %', p_service_id, SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'An internal error occurred. Please try again.'
  );
END;
```

**Pros:** Prevents information disclosure, logs errors for debugging
**Cons:** Harder to debug from client side
**Effort:** Small
**Risk:** Low

### Option B: Error Code Mapping
Map known errors to safe messages:

```sql
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'This operation would create a duplicate');
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referenced record not found');
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'An internal error occurred');
END;
```

**Pros:** Provides useful feedback without exposing internals
**Cons:** More code to maintain
**Effort:** Medium
**Risk:** Low

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql`

**Functions to Fix:**
1. `reschedule_service` (line 137)
2. `client_approve_reschedule` (line 257)
3. `client_deny_reschedule` (line 367)

## Acceptance Criteria

- [ ] SQLERRM is not returned to clients in any RPC function
- [ ] Errors are logged server-side for debugging (RAISE WARNING)
- [ ] Generic error message returned to clients
- [ ] Manual test: Force an error and verify response doesn't contain schema details

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Security sentinel identified as HIGH priority |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- OWASP Error Handling: https://owasp.org/www-community/Improper_Error_Handling
