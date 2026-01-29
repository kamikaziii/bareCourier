---
status: ready
priority: p3
issue_id: "172"
tags: [code-review, performance, database, pr-5]
dependencies: []
---

# Missing Partial Index for Active Breaks Query

## Problem Statement

The `getCurrentBreak()` function queries for breaks where `ended_at IS NULL`. This query would benefit from a partial index to improve performance, especially as the break_logs table grows.

## Findings

**Location:** `src/lib/services/breaks.ts` (lines 22-29)

```typescript
const { data, error } = await supabase
  .from('break_logs')
  .select('*')
  .eq('courier_id', courierId)
  .is('ended_at', null)  // <-- Common filter
  .order('started_at', { ascending: false })
  .limit(1)
  .single();
```

Current index in migration:
```sql
CREATE INDEX idx_break_logs_courier_date ON break_logs (courier_id, started_at);
```

This index doesn't optimize for the `ended_at IS NULL` filter.

## Proposed Solutions

### Option A: Add Partial Index (Recommended)

```sql
CREATE INDEX idx_break_logs_active ON break_logs (courier_id)
  WHERE ended_at IS NULL;
```

**Pros:** Fast lookup for active breaks, small index size (only non-null rows)
**Cons:** Requires migration
**Effort:** Small
**Risk:** Low

**Note:** This also supports the unique constraint needed for issue #165 (race condition fix).

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected files:**
- `supabase/migrations/` (new file)

**Migration:**
```sql
-- supabase/migrations/20260129000005_add_active_break_index.sql
CREATE INDEX idx_break_logs_active ON break_logs (courier_id)
  WHERE ended_at IS NULL;
```

## Acceptance Criteria

- [ ] Partial index created on break_logs
- [ ] Query plan shows index usage for `getCurrentBreak()` query pattern

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (performance-oracle)

**Actions:**
- Analyzed query patterns in breaks service
- Identified optimization opportunity

**Learnings:**
- Partial indexes are valuable for filtering on nullable columns with common NULL checks

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
- PostgreSQL partial indexes: https://www.postgresql.org/docs/current/indexes-partial.html
