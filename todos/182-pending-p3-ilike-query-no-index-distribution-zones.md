---
status: pending
priority: p3
issue_id: "182"
tags: [code-review, performance, database, pr-7]
dependencies: []
---

# `ilike` Query Can't Use Index for Zone Lookups

> **Note:** Downgraded from P2 to P3. For single-courier scale (~50-100 zones), sequential scan is acceptable. The implementation plan explicitly used `ilike` without index consideration.

## Problem Statement

The `isInDistributionZone` function uses `ilike` for case-insensitive matching, but the existing B-tree index on `concelho` cannot be used efficiently for `ILIKE` queries, resulting in sequential scans.

## Findings

**Source:** Performance Oracle Agent

**Location:** `src/lib/services/type-pricing.ts` (lines 148-169)

**Current Code:**
```typescript
const { data, error } = await supabase
    .from('distribution_zones')
    .select('id')
    .ilike('concelho', municipality.trim())  // Can't use standard index
    .limit(1);
```

**Current Index:**
```sql
CREATE INDEX idx_distribution_zones_concelho ON distribution_zones(concelho);
```

**Impact:**
- O(n) sequential scan for every zone check
- At 50 rows: ~5ms (acceptable)
- At 500 rows: ~50ms (problematic)
- Called on every delivery address selection

## Proposed Solutions

### Solution 1: Case-insensitive functional index (Recommended)
```sql
CREATE INDEX idx_distribution_zones_concelho_lower
  ON distribution_zones(lower(concelho));
```
Then normalize data to lowercase and use `eq` instead of `ilike`
- **Pros:** O(log n) lookups, proper index usage
- **Cons:** Requires data normalization
- **Effort:** Medium
- **Risk:** Low

### Solution 2: Client-side caching
Load all zones once, do lookup in memory
- **Pros:** Zero DB queries after initial load
- **Cons:** Stale data if zones change
- **Effort:** Small
- **Risk:** Medium

### Solution 3: Use `citext` column type
PostgreSQL's case-insensitive text type
- **Pros:** Clean solution, works with standard index
- **Cons:** Requires column type change
- **Effort:** Medium
- **Risk:** Medium

## Technical Details

**Affected Files:**
- `src/lib/services/type-pricing.ts`
- New migration for index or column change

## Acceptance Criteria

- [ ] Zone lookups use index efficiently
- [ ] Case-insensitive matching preserved
- [ ] Query time < 10ms regardless of table size

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by performance-oracle agent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
- PostgreSQL `citext`: https://www.postgresql.org/docs/current/citext.html
