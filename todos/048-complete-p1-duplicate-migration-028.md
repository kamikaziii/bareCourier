---
status: ready
priority: p1
issue_id: "048"
tags: [code-review, database, migration]
dependencies: []
---

# Duplicate Migration Number 028

## Problem Statement

Two migration files have the same number (028), which can cause deployment issues in Supabase:
- `028_pricing_display_settings.sql` (from pricing-settings branch)
- `028_setup_notification_cron_jobs.sql` (from main branch past-due feature)

This could cause migration ordering issues and potentially skip one migration during deployment.

## Findings

**Location:**
- `/supabase/migrations/028_pricing_display_settings.sql`
- `/supabase/migrations/028_setup_notification_cron_jobs.sql`

**Evidence:** Both files exist with timestamp difference:
```
-rw-r--r-- 795 Jan 24 23:25 028_pricing_display_settings.sql
-rw-r--r-- 2688 Jan 26 09:00 028_setup_notification_cron_jobs.sql
```

## Proposed Solutions

### Option A: Rename notification cron migration (Recommended)
**Pros:** Simple fix, pricing migration was created first
**Cons:** Need to verify it hasn't been applied yet
**Effort:** Small
**Risk:** Low

Rename `028_setup_notification_cron_jobs.sql` to `031_setup_notification_cron_jobs.sql` (after current highest 030).

### Option B: Rename pricing migration
**Pros:** N/A
**Cons:** Pricing migration was created first chronologically
**Effort:** Small
**Risk:** Low

## Recommended Action

Rename the notification cron jobs migration to 031.

## Technical Details

**Affected Files:**
- `supabase/migrations/028_setup_notification_cron_jobs.sql` → `031_setup_notification_cron_jobs.sql`

## Acceptance Criteria

- [ ] No duplicate migration numbers exist
- [ ] Migrations are numbered sequentially
- [ ] Both migrations can be applied in order

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during merge review | Parallel branch development can create migration number collisions |

## Resources

- Merge commit: 5a458a4
