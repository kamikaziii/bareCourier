---
status: complete
priority: p2
issue_id: "346"
tags: [database, triggers, code-review]
dependencies: ["345"]
---

# Missing DROP TRIGGER IF EXISTS in notifications migration

## Problem Statement

The notifications update trigger migration (000006) creates the trigger at line 72 without a preceding `DROP TRIGGER IF EXISTS` statement. This makes the migration non-idempotent: re-applying it will fail with a "trigger already exists" error.

## Findings

- **Location**: `supabase/migrations/20260213000006_add_notification_update_trigger.sql`, line 72
- **Current code**: `CREATE TRIGGER check_notification_update_fields ...` without preceding DROP
- **Impact**: Migration cannot be safely re-applied; fails on second run
- **Comparison**: Other trigger migrations in the project use `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`

## Proposed Solutions

### Option 1: Add DROP TRIGGER IF EXISTS before CREATE TRIGGER (Recommended)
Add the following line before the CREATE TRIGGER statement:

```sql
DROP TRIGGER IF EXISTS check_notification_update_fields ON public.notifications;
```

- **Pros**: Makes migration idempotent, consistent with other migrations
- **Cons**: None
- **Effort**: Trivial
- **Risk**: Low

## Recommended Action
Option 1: Add DROP TRIGGER IF EXISTS before CREATE TRIGGER.

## Technical Details

- **Affected Files**: `supabase/migrations/20260213000006_add_notification_update_trigger.sql`
- **Related Components**: Notifications trigger
- **Database Changes**: Yes — new migration (or edit existing if not yet applied) to add DROP TRIGGER IF EXISTS
- **Note**: Depends on todo 345 since both touch the same file; should be done together

## Acceptance Criteria

- [ ] Notifications trigger migration includes `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
- [ ] Migration can be re-applied without errors
- [ ] Trigger still functions correctly after re-application

## Work Log

### 2026-02-14 - Discovered during PR #21 security review
**By:** Claude Code Review
**Actions:** Created todo from PR #21 code review findings.

### 2026-02-14 - Fixed
**By:** Claude Code
**Actions:**
- Added `DROP TRIGGER IF EXISTS check_notification_update_fields ON public.notifications;` before CREATE TRIGGER
- Migration is now idempotent, consistent with other trigger migrations in the project
