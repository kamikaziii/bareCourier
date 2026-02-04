---
status: ready
priority: p1
issue_id: "239"
tags: [code-review, migration, database, pr-13]
dependencies: []
---

# CREATE INDEX CONCURRENTLY Cannot Run in Transaction

## Problem Statement

The migration `20260204000003_add_past_due_check_index.sql` uses `CREATE INDEX CONCURRENTLY`, but Supabase migrations run in transaction blocks. PostgreSQL does not allow `CREATE INDEX CONCURRENTLY` inside a transaction, causing the migration to fail.

## Findings

**Source:** data-migration-expert agent

**Location:** `supabase/migrations/20260204000003_add_past_due_check_index.sql` line 4

**Current code:**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
WHERE deleted_at IS NULL;
```

**Error produced:**
```
ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

**Impact:**
- Migration FAILS completely
- Blocks deployment of PR #13
- Index is never created

## Proposed Solutions

### Solution 1: Remove CONCURRENTLY (Recommended for small tables)
**Pros:** Simple fix, works in all environments
**Cons:** Brief table lock during index creation
**Effort:** Small
**Risk:** Low (services table is likely small)

```sql
CREATE INDEX IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
WHERE deleted_at IS NULL;
```

### Solution 2: Run Index Creation Manually
**Pros:** Can use CONCURRENTLY
**Cons:** Manual step, not automated in CI/CD
**Effort:** Medium (requires deployment procedure change)
**Risk:** Medium (might be forgotten)

Remove from migration, document manual step:
```sql
-- Run in SQL Editor AFTER migration completes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
WHERE deleted_at IS NULL;
```

### Solution 3: Split Migration
**Pros:** Cleaner separation
**Cons:** Supabase may not support non-transactional migrations
**Effort:** Medium
**Risk:** Unknown

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000003_add_past_due_check_index.sql`

**Table:** `services`

**Index Details:**
- Composite index on (status, scheduled_date)
- Partial index with WHERE deleted_at IS NULL
- Used by check-past-due cron job queries

## Acceptance Criteria

- [ ] Migration runs successfully
- [ ] Index is created on services table
- [ ] Index is used by past-due check queries (verify with EXPLAIN)
- [ ] No significant table lock during production deployment

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | CONCURRENTLY requires non-transactional context |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- PostgreSQL Index Concurrency: https://www.postgresql.org/docs/current/sql-createindex.html
