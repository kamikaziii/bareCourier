---
status: pending
priority: p3
issue_id: "187"
tags: [code-review, security, rls, pr-7]
dependencies: []
---

# Overlapping RLS Policies on `service_types`

## Problem Statement

Two SELECT policies exist that can overlap: one for courier (reads all) and one that uses `active = true` without role check. The naming suggests client-only access but any user matches.

## Findings

**Source:** Data Integrity Guardian Agent

**Location:** `supabase/migrations/20260129130000_add_service_types_table.sql` (lines 25-32)

**Current Policies:**
```sql
-- Policy 1: Courier can read ALL
CREATE POLICY "service_types_select_courier" ON service_types
  FOR SELECT
  USING (public.is_courier());

-- Policy 2: Supposedly for clients, but matches any user when active=true
CREATE POLICY "service_types_select_client" ON service_types
  FOR SELECT
  USING (active = true);
```

**Impact:**
- Policy naming misleading (doesn't verify caller is client)
- Could allow unauthenticated access if auth layer misconfigured
- Confusing for future maintenance

## Proposed Solutions

### Solution 1: Make client policy explicit (Recommended)
```sql
CREATE POLICY "service_types_select_client" ON service_types
  FOR SELECT
  USING (active = true AND NOT public.is_courier());
```
- **Pros:** Clear separation of access
- **Cons:** Slightly more restrictive
- **Effort:** Small
- **Risk:** Low

### Solution 2: Document current behavior
Add comments explaining policy overlap is intentional
- **Pros:** No code change
- **Cons:** Doesn't fix underlying issue
- **Effort:** Minimal
- **Risk:** Low

## Technical Details

**Affected Files:**
- `supabase/migrations/20260129130000_add_service_types_table.sql`
- New migration to update policy

## Acceptance Criteria

- [ ] RLS policies clearly express intended access patterns
- [ ] No unintended access possible

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by data-integrity-guardian agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
