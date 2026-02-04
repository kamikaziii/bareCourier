---
status: pending
priority: p2
issue_id: "220"
tags: [database, code-review, migration, pr-13]
dependencies: []
---

# Cron Job Migration Has No Rollback Strategy

## Problem Statement

The migration `20260204000002_enable_notification_cron_jobs.sql` schedules cron jobs but provides no way to unschedule them if the migration needs to be rolled back. If reverted, the cron jobs will continue running, potentially calling non-existent edge functions or causing duplicate notifications.

**Impact:** Unable to cleanly roll back this migration; orphaned cron jobs may cause errors.

## Findings

**Location:** `supabase/migrations/20260204000002_enable_notification_cron_jobs.sql`

Current migration only schedules jobs:
```sql
SELECT cron.schedule('check-past-due-services', '*/15 * * * *', ...);
SELECT cron.schedule('daily-summary-notification', '*/15 * * * *', ...);
```

No rollback commands provided.

## Proposed Solutions

### Option A: Add Rollback Comments (Minimum)

Add a comment block with rollback instructions:

```sql
-- ROLLBACK INSTRUCTIONS:
-- To undo this migration, run:
--   SELECT cron.unschedule('check-past-due-services');
--   SELECT cron.unschedule('daily-summary-notification');
```

**Pros:** Documents rollback procedure
**Cons:** Manual process, easy to miss
**Effort:** Tiny
**Risk:** Low

### Option B: Make Migration Idempotent (Recommended)

Add unschedule before schedule to handle re-runs and make rollback explicit:

```sql
-- Ensure idempotent: remove existing jobs first
SELECT cron.unschedule('check-past-due-services');
SELECT cron.unschedule('daily-summary-notification');

-- Schedule the jobs
SELECT cron.schedule('check-past-due-services', '*/15 * * * *', ...);
SELECT cron.schedule('daily-summary-notification', '*/15 * * * *', ...);
```

**Pros:** Handles re-runs, clear pattern for rollback
**Cons:** Slightly more complex
**Effort:** Small
**Risk:** Low

### Option C: Add Prerequisite Validation

Ensure extensions and secrets exist before scheduling:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension must be enabled via Supabase Dashboard first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension must be enabled via Supabase Dashboard first';
  END IF;
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') IS NULL THEN
    RAISE EXCEPTION 'Vault secret "project_url" not found';
  END IF;
  IF (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NULL THEN
    RAISE EXCEPTION 'Vault secret "service_role_key" not found';
  END IF;
END $$;
```

**Pros:** Fails fast with clear error messages
**Cons:** More code
**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**
- `supabase/migrations/20260204000002_enable_notification_cron_jobs.sql`

**Dependencies:**
- `pg_cron` extension (enabled via Dashboard)
- `pg_net` extension (enabled via Dashboard)
- Vault secrets: `project_url`, `service_role_key`

**Verification Query:**
```sql
-- Check cron jobs after migration
SELECT jobname, schedule, active FROM cron.job
WHERE jobname IN ('check-past-due-services', 'daily-summary-notification');
```

## Acceptance Criteria

- [ ] Migration includes rollback instructions (comments or code)
- [ ] Migration is idempotent (can be run multiple times safely)
- [ ] Prerequisites validated before scheduling
- [ ] Tested: Run migration, verify jobs scheduled, rollback, verify jobs removed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #13 code review | Data migration expert flagged missing rollback |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- pg_cron documentation: https://github.com/citusdata/pg_cron
- Greptile review comment: https://github.com/kamikaziii/bareCourier/pull/13#discussion_r2761819622
- Greptile review comment: https://github.com/kamikaziii/bareCourier/pull/13#discussion_r2761819652
