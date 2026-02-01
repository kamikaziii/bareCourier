---
status: complete
priority: p1
issue_id: "195"
tags: [code-review, database, migration, pr-10]
dependencies: []
---

# Database Migration Uses Overly Aggressive Table-Level Locking

## Problem Statement

The migration `20260131160000_fix_display_id_race_condition.sql` replaces a proven atomic UPSERT pattern with a more complex SELECT-UPDATE flow that uses `LOCK TABLE service_counters IN EXCLUSIVE MODE`. This is overkill and introduces unnecessary contention.

The original `INSERT ... ON CONFLICT DO UPDATE RETURNING` pattern was already atomic and race-condition-free. The "fix" solves a potentially non-existent problem while introducing performance bottlenecks.

## Findings

**Reviewers:** data-integrity-guardian, data-migration-expert, performance-oracle, dhh-rails-reviewer

1. `LOCK TABLE ... IN EXCLUSIVE MODE` blocks ALL reads and writes, serializing all service creation
2. The `FOR UPDATE` on line 30-31 is redundant after table lock
3. Original UPSERT pattern was already atomic:
   ```sql
   INSERT INTO service_counters (year, last_number, updated_at)
   VALUES (current_year, 1, now())
   ON CONFLICT (year) DO UPDATE
     SET last_number = service_counters.last_number + 1
   RETURNING last_number INTO next_number;
   ```
4. No verification provided that duplicate display_ids actually exist in production
5. Migration could cause in-flight transaction failures during deployment (DROP TRIGGER window)

## Proposed Solutions

### Option A: Revert to Original UPSERT Pattern (Recommended)
- **Pros:** Proven atomic, no table locking, simpler code
- **Cons:** Need to verify original race condition was theoretical
- **Effort:** Small (15 mins)
- **Risk:** Low

### Option B: Use Advisory Locks Instead
```sql
PERFORM pg_advisory_xact_lock(hashtext('display_id_' || current_year::text));
```
- **Pros:** More granular locking per year
- **Cons:** More complex than needed for solo courier app
- **Effort:** Small (30 mins)
- **Risk:** Low

### Option C: Remove Table Lock, Keep FOR UPDATE Only
- **Pros:** Row-level locking sufficient for this use case
- **Cons:** Still more complex than original UPSERT
- **Effort:** Small (10 mins)
- **Risk:** Low

## Technical Details

**Affected files:**
- `supabase/migrations/20260131160000_fix_display_id_race_condition.sql`

**Verification query (run before deploying):**
```sql
SELECT display_id, COUNT(*) FROM services
WHERE display_id IS NOT NULL
GROUP BY display_id HAVING COUNT(*) > 1;
```

## Acceptance Criteria

- [ ] Verify whether duplicate display_ids actually exist in production
- [ ] If not, revert to original atomic UPSERT pattern
- [ ] If yes, use minimal row-level locking (remove EXCLUSIVE MODE)
- [ ] Remove redundant FOR UPDATE clause
- [ ] Avoid DROP TRIGGER + CREATE TRIGGER pattern (use CREATE OR REPLACE only)

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-02-01 | Identified during PR #10 review | Created todo |

## Resources

- PR #10: https://github.com/kamikaziii/bareCourier/pull/10
- Original migration: `20260129150000_add_service_display_ids.sql`
