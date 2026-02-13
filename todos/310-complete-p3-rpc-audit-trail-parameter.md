---
status: complete
priority: p3
issue_id: "310"
tags: [data-integrity, rls, supabase, audit-trail]
dependencies: []
---

# RPC Audit Trail Uses Caller-Supplied User ID Instead of auth.uid()

## Problem Statement

The `approve_reschedule()` and `deny_reschedule()` RPC functions accept caller-supplied `p_approved_by`/`p_denied_by` parameters and write them to `service_reschedule_history.approved_by`. They should use `v_user_id` (derived from `auth.uid()`) instead to ensure audit trail integrity.

Impact is minimal since only the courier can call these functions and there is only one courier, but it violates the principle of server-authoritative audit trails.

## Findings

- `approve_reschedule()` in migration `20260121000038_fix_approve_reschedule_auth_check.sql` (line 83) writes `p_approved_by` parameter to the reschedule history record
- `deny_reschedule()` in migration `20260121000039_fix_deny_reschedule_auth_check.sql` (line 72) writes `p_denied_by` parameter to the reschedule history record
- Both functions already compute `v_user_id := auth.uid()` and use it for authorization checks
- The caller-supplied parameter could theoretically contain any UUID, though only the courier can call these functions
- Best practice: audit trail fields should always use server-derived values, never client-supplied

**Affected files:**
- `supabase/migrations/20260121000038_fix_approve_reschedule_auth_check.sql` line 83
- `supabase/migrations/20260121000039_fix_deny_reschedule_auth_check.sql` line 72

## Proposed Solutions

### Option 1: Replace Parameter with v_user_id

**Approach:** In both functions, replace the caller-supplied `p_approved_by`/`p_denied_by` with `v_user_id` in the history UPDATE statement.

```sql
-- In approve_reschedule():
-- Before: approved_by = p_approved_by
-- After:  approved_by = v_user_id

-- In deny_reschedule():
-- Before: denied_by = p_denied_by  (written to approved_by column)
-- After:  denied_by = v_user_id
```

Optionally remove the `p_approved_by`/`p_denied_by` parameters entirely if they are not used elsewhere.

**Pros:**
- Simple one-line change in each function
- Ensures audit trail integrity
- Follows principle of least privilege

**Cons:**
- Must check if the parameters are used by the frontend and update accordingly
- Breaking change if frontend passes these parameters

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260121000038_fix_approve_reschedule_auth_check.sql` - approve_reschedule()
- `supabase/migrations/20260121000039_fix_deny_reschedule_auth_check.sql` - deny_reschedule()
- Frontend code that calls these RPCs (may pass the parameter)
- New migration required

**Database changes:**
- Migration needed: Yes
- Updated functions: `approve_reschedule()`, `deny_reschedule()`
- May remove parameters from function signatures

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review

## Acceptance Criteria

- [ ] `approve_reschedule()` uses `v_user_id` (from auth.uid()) for the approved_by field
- [ ] `deny_reschedule()` uses `v_user_id` (from auth.uid()) for the denied_by field
- [ ] Frontend updated if parameter signatures change
- [ ] Reschedule approval/denial flows still work correctly
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Reviewed approve_reschedule() and deny_reschedule() RPC functions
- Identified caller-supplied parameters used for audit trail fields
- Confirmed both functions already have v_user_id available from auth.uid()
- Assessed impact as low (single courier system)

**Learnings:**
- Audit trail fields should always be server-authoritative
- Even in single-user admin scenarios, using auth.uid() is the correct pattern
- The parameters were likely added for convenience but create a bad precedent
