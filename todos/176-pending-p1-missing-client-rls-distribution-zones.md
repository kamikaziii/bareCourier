---
status: pending
priority: p1
issue_id: "176"
tags: [code-review, security, rls, pr-7]
dependencies: []
---

# Missing Client Read Access to Distribution Zones

## Problem Statement

The `distribution_zones` table has RLS policies only for the courier role. Clients cannot read distribution zones, causing `isInDistributionZone()` to always return false when called from client context. This means zone detection is broken for clients.

## Findings

**Source:** Security Sentinel Agent, Data Integrity Guardian Agent

**Location:** `supabase/migrations/20260129130001_add_distribution_zones_table.sql`

**Current Policies:**
```sql
-- Only courier SELECT policy exists
CREATE POLICY "distribution_zones_select_courier" ON distribution_zones
  FOR SELECT
  USING (public.is_courier());
```

**Impact:**
- `isInDistributionZone()` fails silently for clients (returns empty result)
- All client deliveries incorrectly marked as "out of zone"
- Clients may be overcharged if out-of-zone pricing applies

## Proposed Solutions

### Solution 1: Server-side zone checking only (Recommended - aligns with design)
Move zone detection to server-side only. The design doc (line 179) says "RLS: Courier only" which means zone checking should happen in form actions, not client-side.

**Implementation:**
- Remove client-side `isInDistributionZone()` calls from `+page.svelte` files
- Have the server action return `isOutOfZone: boolean` as part of address validation
- Use server-side geocoding response to detect municipality

- **Pros:** Aligns with design intent, more secure
- **Cons:** Requires refactoring UI to not call zone check client-side
- **Effort:** Medium
- **Risk:** Low

### Solution 2: Add client read policy
```sql
CREATE POLICY "distribution_zones_select_client" ON distribution_zones
  FOR SELECT
  USING (true);  -- Read-only for all authenticated users
```
- **Pros:** Simple, enables current client-side zone detection
- **Cons:** Contradicts design doc "Courier only" intent, exposes zone configuration
- **Effort:** Small
- **Risk:** Low

> **Design Note:** The design doc has an inconsistency - it says "Courier only" RLS but shows client UI doing zone checks. Solution 1 aligns with the RLS design.

## Technical Details

**Affected Files:**
- `supabase/migrations/20260129130001_add_distribution_zones_table.sql`
- `src/lib/services/type-pricing.ts` (isInDistributionZone function)
- `src/routes/client/new/+page.svelte` (calls zone check)

## Acceptance Criteria

- [ ] Clients can successfully check if delivery location is in-zone
- [ ] Zone detection returns correct boolean (not always false)
- [ ] OR: Client UI doesn't rely on client-side zone checks

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by security-sentinel and data-integrity-guardian agents |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
- RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
