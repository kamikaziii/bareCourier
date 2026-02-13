---
status: complete
priority: p3
issue_id: "311"
tags: [security, rls, supabase, consistency]
dependencies: []
---

# urgency_fees Table Allows Anonymous (Unauthenticated) Access

## Problem Statement

The `urgency_fees_select_all` RLS policy uses `USING (true)` with no `TO` clause, allowing anonymous (unauthenticated) users to read all urgency fee tiers. This was explicitly kept intentional in migration 000044, but it is inconsistent with `service_types` which was fixed to require authentication in migration `20260206000006`.

## Findings

- Migration `20260121000016_create_urgency_fees.sql` (lines 26-28) defines:
  ```sql
  CREATE POLICY "urgency_fees_select_all" ON urgency_fees
    FOR SELECT USING (true);
  ```
- No `TO authenticated` clause, meaning `anon` role can also read
- Migration `20260121000044` explicitly kept this as intentional
- However, `service_types` was subsequently fixed in migration `20260206000006` to require authentication
- This creates an inconsistency: service_types requires auth but urgency_fees does not
- Practical risk is low -- urgency fee tiers are not sensitive data (they are pricing tiers like "standard", "express", "urgent")
- However, exposing business pricing configuration to unauthenticated users is unnecessary

**Affected file:** `supabase/migrations/20260121000016_create_urgency_fees.sql` lines 26-28

## Proposed Solutions

### Option 1: Add Authentication Requirement

**Approach:** Replace `USING (true)` with `USING (auth.uid() IS NOT NULL)` or add `TO authenticated` to match the `service_types` pattern.

```sql
DROP POLICY "urgency_fees_select_all" ON urgency_fees;
CREATE POLICY "urgency_fees_select_authenticated" ON urgency_fees
  FOR SELECT TO authenticated USING (true);
```

**Pros:**
- Consistent with service_types policy
- Reduces attack surface
- Simple change

**Cons:**
- Minimal practical impact
- If any unauthenticated flow needs urgency fees, it would break

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260121000016_create_urgency_fees.sql` - current policy
- New migration required

**Database changes:**
- Migration needed: Yes
- Drop and recreate SELECT policy with `TO authenticated`

## Resources

- **Source:** RLS Security Audit - 4-agent parallel review
- **Related:** Migration `20260206000006` that fixed the same issue for service_types

## Acceptance Criteria

- [ ] Anonymous users cannot read urgency_fees table
- [ ] Authenticated users (both client and courier) can still read urgency fees
- [ ] Service creation flow still works (urgency fee selection)
- [ ] Consistent with service_types access policy
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Identified inconsistency between urgency_fees and service_types access policies
- Reviewed migration 000044 that explicitly kept anon access
- Confirmed service_types was subsequently fixed to require auth
- Assessed practical risk as low (pricing tiers are not sensitive)

**Learnings:**
- Consistency in RLS policies helps maintain security posture
- Policies marked as "intentional" should be re-evaluated when related policies change
- The defense-in-depth principle suggests requiring auth even for non-sensitive data
