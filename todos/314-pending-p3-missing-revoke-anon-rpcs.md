---
status: pending
priority: p3
issue_id: "314"
tags: [security, supabase, defense-in-depth]
dependencies: []
---

# Missing REVOKE anon for 4 RPC Functions

## Problem Statement

Migration `20260121000043` revokes anonymous execution from 5 RPC functions but omits 4 others: `bulk_reschedule_services`, `client_approve_reschedule`, `client_deny_reschedule`, and `replace_distribution_zones`. The initial schema's `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` provides baseline protection, and all functions have internal auth checks. This is a defense-in-depth improvement.

## Findings

- Migration `20260121000043_revoke_anon_permissions_from_rpcs.sql` revokes anon from 5 functions, but 4 functions created in later migrations lack explicit REVOKE:
  1. `bulk_reschedule_services` - created in 20260206000004 (courier-only bulk operation)
  2. `client_approve_reschedule` - created in 20260204000001 (client reschedule approval)
  3. `client_deny_reschedule` - created in 20260204000001 (client reschedule denial)
  4. `replace_distribution_zones` - created in 20260129140003 (courier-only zone management)
- These were not "omitted" from 000043 — they simply didn't exist yet when that migration was written
- The schema-level `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` provides baseline protection (functions created after this statement are not callable by anon by default)
- All 4 functions have internal `auth.uid()` checks that would reject anonymous callers
- The missing REVOKEs mean these functions rely on two layers of protection (default privileges + internal checks) instead of three (+ explicit REVOKE)
- Practical risk is very low given the existing protections

**Affected file:** `supabase/migrations/20260121000043_revoke_anon_permissions_from_rpcs.sql`

## Proposed Solutions

### Option 1: Add Explicit REVOKE for Missing Functions

**Approach:** Create a migration that adds `REVOKE EXECUTE ON FUNCTION ... FROM anon` for the 4 missing functions.

```sql
REVOKE EXECUTE ON FUNCTION bulk_reschedule_services FROM anon;
REVOKE EXECUTE ON FUNCTION client_approve_reschedule FROM anon;
REVOKE EXECUTE ON FUNCTION client_deny_reschedule FROM anon;
REVOKE EXECUTE ON FUNCTION replace_distribution_zones FROM anon;
```

**Pros:**
- Consistent with the pattern established in migration 000043
- Defense-in-depth: adds a third layer of protection
- Simple, low-risk change
- Makes the security posture auditable

**Cons:**
- Minimal practical impact given existing protections
- One more migration to maintain

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260121000043_revoke_anon_permissions_from_rpcs.sql` - existing revocations
- New migration required

**Database changes:**
- Migration needed: Yes
- Add REVOKE EXECUTE for 4 functions

**Existing protections (defense layers):**
1. `ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (schema level)
2. Internal `auth.uid()` checks in each function (application level)
3. Explicit REVOKE (to be added -- belt-and-suspenders)

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review

## Acceptance Criteria

- [ ] `REVOKE EXECUTE ON FUNCTION bulk_reschedule_services FROM anon` applied
- [ ] `REVOKE EXECUTE ON FUNCTION client_approve_reschedule FROM anon` applied
- [ ] `REVOKE EXECUTE ON FUNCTION client_deny_reschedule FROM anon` applied
- [ ] `REVOKE EXECUTE ON FUNCTION replace_distribution_zones FROM anon` applied
- [ ] All 4 functions still callable by authenticated users with correct roles
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Compared migration 000043 revocation list against all RPC functions
- Identified 4 functions missing explicit REVOKE
- Verified baseline protections (default privileges + internal auth checks)
- Assessed practical risk as very low

**Learnings:**
- Defense-in-depth means adding protections even when existing layers cover the case
- When adding new RPC functions, they should be included in the REVOKE list
- A comprehensive REVOKE migration should be maintained as functions are added
