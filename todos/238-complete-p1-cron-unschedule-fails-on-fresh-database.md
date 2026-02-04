---
status: ready
priority: p1
issue_id: "238"
tags: [code-review, migration, database, pr-13]
dependencies: []
---

# cron.unschedule() Fails on Fresh Database

## Problem Statement

The migration `20260204000002_enable_notification_cron_jobs.sql` calls `cron.unschedule()` without error handling. This function throws an error if the job doesn't exist, causing the migration to fail on fresh deployments.

## Findings

**Source:** data-migration-expert agent

**Location:** `supabase/migrations/20260204000002_enable_notification_cron_jobs.sql` lines 9 and 30

**Current code:**
```sql
SELECT cron.unschedule('check-past-due-services');
-- ... later ...
SELECT cron.unschedule('daily-summary-notification');
```

**Impact:**
- Migration will FAIL on any database where these cron jobs don't already exist
- This includes fresh deployments, new environments, and CI/CD pipelines
- Blocks the entire PR from being deployable to new environments

## Proposed Solutions

### Solution 1: Wrap in Exception Handler (Recommended)
**Pros:** Clean, explicit error handling
**Cons:** Slightly more verbose
**Effort:** Small
**Risk:** Low

```sql
DO $$
BEGIN
  PERFORM cron.unschedule('check-past-due-services');
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'Job check-past-due-services does not exist, skipping unschedule';
END $$;
```

### Solution 2: Check Job Exists First
**Pros:** No exception handling needed
**Cons:** Requires extra query
**Effort:** Small
**Risk:** Low

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-past-due-services') THEN
    PERFORM cron.unschedule('check-past-due-services');
  END IF;
END $$;
```

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000002_enable_notification_cron_jobs.sql`

**Related Components:**
- pg_cron extension
- Cron job scheduling

**Database Changes:**
- Cron job creation/replacement

## Acceptance Criteria

- [ ] Migration runs successfully on fresh database
- [ ] Migration runs successfully on database with existing jobs
- [ ] Migration is idempotent (can run multiple times)
- [ ] Cron jobs are correctly scheduled after migration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | cron.unschedule() is not idempotent |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- pg_cron documentation: https://github.com/citusdata/pg_cron
