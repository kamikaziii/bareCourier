---
status: pending
priority: p2
issue_id: "177"
tags: [code-review, data-integrity, race-condition, pr-7]
dependencies: []
---

# Non-Atomic `saveDistributionZones` Operation

> **Note:** Downgraded from P1 to P2. Implementation plan explicitly chose "simpler than diffing" approach. At single-courier scale (~50 zones), risk is low.

## Problem Statement

The `saveDistributionZones` action deletes all zones then inserts new ones in separate operations without a transaction. If the delete succeeds but insert fails, all zone data is lost with no recovery.

## Findings

**Source:** Performance Oracle Agent, Data Integrity Guardian Agent

**Location:** `src/routes/courier/settings/+page.server.ts` (lines 864-903)

**Current Code:**
```typescript
// Delete all existing zones and insert new ones
const { error: deleteError } = await supabase
    .from('distribution_zones')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

if (deleteError) {
    return fail(500, { error: 'Failed to update zones' });
}

if (zones.length > 0) {
    const { error: insertError } = await supabase
        .from('distribution_zones')
        .insert(zones);
    // ...
}
```

**Impact:**
- Race condition: If insert fails after delete, all zones are lost
- During delete-then-insert window, concurrent zone checks return incorrect results
- No rollback mechanism

## Proposed Solutions

### Solution 1: Database RPC function (Recommended)
```sql
CREATE OR REPLACE FUNCTION replace_distribution_zones(new_zones jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM distribution_zones WHERE true;
  INSERT INTO distribution_zones (distrito, concelho)
  SELECT z->>'distrito', z->>'concelho'
  FROM jsonb_array_elements(new_zones) AS z;
END;
$$;
```
- **Pros:** Atomic, clean API, RLS bypass handled properly
- **Cons:** Requires new migration
- **Effort:** Medium
- **Risk:** Low

### Solution 2: Upsert pattern
Delete only zones not in new list, insert/update others
- **Pros:** No transaction needed, more incremental
- **Cons:** More complex logic
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

**Affected Files:**
- `src/routes/courier/settings/+page.server.ts`
- New migration file needed

## Acceptance Criteria

- [ ] Zone replacement is atomic (all-or-nothing)
- [ ] No data loss on insert failure
- [ ] Concurrent zone checks remain consistent

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by performance-oracle and data-integrity-guardian agents |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
- PostgreSQL PL/pgSQL: https://www.postgresql.org/docs/current/plpgsql.html
