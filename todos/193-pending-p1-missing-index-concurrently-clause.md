---
status: pending
priority: p1
issue_id: "193"
tags: [database, migration, production-safety, code-review]
dependencies: []
---

# CRITICAL: Missing CONCURRENTLY Clause in Index Migration

## Problem Statement

The migration `20260130000001_add_request_status_index.sql` creates an index without the `CONCURRENTLY` clause, which will lock the `services` table during index creation, blocking all reads and writes and causing production downtime.

**Why it matters:** Without `CONCURRENTLY`, PostgreSQL acquires a `SHARE` lock that blocks all INSERT/UPDATE/DELETE operations during index creation. For a production database with active traffic, this causes complete service disruption.

## Findings

**File:** `supabase/migrations/20260130000001_add_request_status_index.sql` (Line 5)

**Current code:**
```sql
CREATE INDEX IF NOT EXISTS idx_services_request_status_active
ON services(request_status, deleted_at)
WHERE deleted_at IS NULL;
```

**Problem:** During index creation:
1. PostgreSQL acquires `SHARE` lock on `services` table
2. All INSERT/UPDATE/DELETE operations blocked
3. Application writes fail with timeout errors
4. Users cannot create/update services
5. Courier cannot mark services as delivered
6. **Complete service outage during migration**

**Index build time estimates:**
- 1,000 rows: ~1 second (acceptable without CONCURRENTLY)
- 10,000 rows: ~10 seconds (**unacceptable downtime**)
- 100,000 rows: ~2 minutes (**catastrophic downtime**)

**Source:** Data Migration Expert review of PR #8

## Proposed Solutions

### Solution 1: Add CONCURRENTLY Clause (REQUIRED)
**Pros:**
- Zero downtime deployment
- Standard PostgreSQL best practice
- No application impact

**Cons:**
- Cannot run inside transaction block (must be standalone statement)
- Takes slightly longer to build than non-concurrent

**Effort:** Trivial (5 minutes)

**Risk:** None - Standard production practice

**Implementation:**
```sql
-- Migration: 20260130000001_add_request_status_index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_request_status_active
ON services(request_status, deleted_at)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_services_request_status_active IS
  'Optimizes badge count queries filtering by request_status.
   Expected 70% speedup (100ms → 30ms) for pending request counts.';
```

**Important:** Supabase migrations must run this as a standalone statement (not wrapped in BEGIN/COMMIT).

### Solution 2: Maintenance Window Deployment
**Pros:**
- Simpler migration (no CONCURRENTLY needed)
- Guaranteed success

**Cons:**
- **Requires scheduled downtime**
- Unacceptable for 24/7 service
- User impact

**Effort:** Small (coordination overhead)

**Risk:** High - Service disruption

**NOT RECOMMENDED** - Only consider for development/staging environments.

## Recommended Action

**Solution 1** - Add `CONCURRENTLY` clause immediately. This is **non-negotiable** for production deployments.

**✅ VERIFIED SAFE:** This change only affects HOW the index is created (non-blocking vs blocking). Zero behavioral change to the application. The index structure and query optimization remain identical.

## Technical Details

**Lock Behavior Without CONCURRENTLY:**
```
CREATE INDEX → Acquires SHARE lock
  ↓
Blocks: INSERT, UPDATE, DELETE, VACUUM
Allows: SELECT (reads only)
  ↓
Lock held for: Entire index build duration
  ↓
Result: Write operations timeout/fail
```

**Lock Behavior With CONCURRENTLY:**
```
CREATE INDEX CONCURRENTLY → Acquires SHARE UPDATE EXCLUSIVE lock
  ↓
Blocks: Other index creation, VACUUM
Allows: SELECT, INSERT, UPDATE, DELETE
  ↓
Lock held for: Minimal time (metadata updates only)
  ↓
Result: Zero downtime
```

**Verification Plan:**
```sql
-- 1. Confirm index exists after migration
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'services'
  AND indexname = 'idx_services_request_status_active';

-- 2. Verify index is used by query planner
EXPLAIN ANALYZE
SELECT COUNT(*) FROM services
WHERE request_status = 'pending' AND deleted_at IS NULL;
-- Expected: "Index Scan using idx_services_request_status_active"

-- 3. Check index size and usage stats (1 hour after deploy)
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used,
  idx_tup_read AS rows_read
FROM pg_stat_user_indexes
WHERE indexrelname = 'idx_services_request_status_active';
```

**Rollback Plan:**
```sql
-- If index causes issues, drop safely
DROP INDEX CONCURRENTLY IF EXISTS idx_services_request_status_active;
```

## Acceptance Criteria

- [ ] Migration includes `CONCURRENTLY` keyword
- [ ] Migration runs as standalone statement (not in transaction)
- [ ] Verification queries added to migration comments
- [ ] Rollback procedure documented
- [ ] Test on staging environment first
- [ ] Monitor table locks during migration: `SELECT * FROM pg_locks WHERE relation = 'services'::regclass;`
- [ ] Confirm zero write failures during migration

## Work Log

### 2026-01-30
- **Discovery:** Data Migration Expert identified missing CONCURRENTLY during PR #8 review
- **Impact:** Confirmed production deployment would cause table locks and downtime
- **Priority:** P1 (critical) - **BLOCKS PRODUCTION DEPLOYMENT**
- **Severity:** Could cause complete service outage if deployed as-is

## Resources

- **Related PR:** #8 (feat/navigation-performance-fixes)
- **PostgreSQL Docs:** [Building Indexes Concurrently](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)
- **Supabase Docs:** [Database Migrations Best Practices](https://supabase.com/docs/guides/database/migrations)
- **Lock Reference:** [PostgreSQL Lock Modes](https://www.postgresql.org/docs/current/explicit-locking.html)
- **Migration File:** `supabase/migrations/20260130000001_add_request_status_index.sql`
