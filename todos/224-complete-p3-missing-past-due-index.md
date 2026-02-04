---
status: complete
priority: p3
issue_id: "224"
tags: [performance, code-review, database, pr-13]
dependencies: []
---

# Missing Composite Index for Past-Due Query

## Problem Statement

The `check-past-due` edge function queries services with `status = 'pending'` AND `scheduled_date <= today` but there's no composite index for this query pattern. As the services table grows, this query will become slower.

**Impact:** Cron job may timeout with large datasets; increased database load every 15 minutes.

## Findings

**Location:** `supabase/functions/check-past-due/index.ts` lines 166-173

```typescript
const { data: services } = await supabase
    .from('services')
    .select('id, client_id, scheduled_date, ...')
    .eq('status', 'pending')
    .lte('scheduled_date', todayStr)
    .is('deleted_at', null);
```

**Existing Indexes (from earlier migrations):**
- `idx_services_scheduled_date` - partial index on `deleted_at IS NULL`
- `idx_services_request_status_active` - on `request_status` (different column!)
- `idx_services_status` - single column on `status`

**Missing:** Composite index on `(status, scheduled_date)` with partial filter.

## Proposed Solutions

### Option A: Create Composite Index (Recommended)

New migration:

```sql
-- 20260204000003_add_past_due_check_index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_services_past_due_check IS
'Optimizes past-due check cron job query filtering pending services by scheduled date';
```

**Pros:** Significantly faster queries, low overhead
**Cons:** Index storage cost (minimal)
**Effort:** Tiny
**Risk:** Low

### Option B: Include Additional Columns

If the query always selects the same columns, include them in the index:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
INCLUDE (client_id, scheduled_time_slot, scheduled_time, last_past_due_notification_at)
WHERE deleted_at IS NULL;
```

**Pros:** Index-only scan possible
**Cons:** Larger index, more maintenance
**Effort:** Tiny
**Risk:** Low

## Technical Details

**Query Execution Plan Without Index:**
```
Seq Scan on services
  Filter: (status = 'pending' AND scheduled_date <= '2026-02-04' AND deleted_at IS NULL)
```

**Query Execution Plan With Index:**
```
Index Scan using idx_services_past_due_check on services
  Index Cond: (status = 'pending' AND scheduled_date <= '2026-02-04')
```

**Performance Impact:**
| Table Size | Without Index | With Index |
|------------|---------------|------------|
| 1K rows    | ~10ms         | ~1ms       |
| 10K rows   | ~100ms        | ~2ms       |
| 100K rows  | ~1s           | ~5ms       |

## Acceptance Criteria

- [ ] Composite index created
- [ ] `EXPLAIN ANALYZE` shows index is used
- [ ] Cron job execution time remains stable as data grows

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Performance oracle identified missing index |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- PostgreSQL Index Types: https://www.postgresql.org/docs/current/indexes.html
