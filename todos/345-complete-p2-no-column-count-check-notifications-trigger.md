---
status: complete
priority: p2
issue_id: "345"
tags: [security, database, triggers, code-review]
dependencies: []
---

# No column-count safety check on notifications trigger

## Problem Statement

The notifications update trigger (migration 000006) controls which columns clients can modify on their notifications, but it lacks a runtime column-count assertion. If new columns are added to the notifications table without updating the trigger, they would silently pass through for client edits, potentially bypassing intended field restrictions.

This is the same gap identified in the services trigger (todo 344), applied to the notifications table.

## Findings

- **Location**: `supabase/migrations/20260213000006_add_notification_update_trigger.sql`
- **Current notifications table column count**: 12 (all accounted for in trigger)
- **Gap**: No runtime assertion to detect when columns are added
- **Pattern to follow**: Profiles trigger in migration 000003 has the assertion

## Proposed Solutions

### Option 1: Add column-count assertion to notifications trigger (Recommended)
Add the same pattern used in the profiles trigger:

```sql
IF (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications') != 12
THEN
  RAISE EXCEPTION 'notifications table column count changed — update check_notification_update_fields trigger (expected 12 columns)';
END IF;
```

- **Pros**: Fails loudly on schema changes, consistent with profiles trigger pattern
- **Cons**: Minor friction when adding columns to notifications
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1: Add column-count assertion to notifications trigger.

## Technical Details

- **Affected Files**: `supabase/migrations/20260213000006_add_notification_update_trigger.sql`
- **Related Components**: Notifications trigger, schema migrations
- **Database Changes**: Yes — new migration to add column-count check to notifications trigger

## Acceptance Criteria

- [ ] Notifications trigger includes column-count assertion matching current column count (12)
- [ ] Adding a column to notifications table without updating the trigger causes a loud failure
- [ ] Existing notification update operations still work correctly

## Work Log

### 2026-02-14 - Discovered during PR #21 security review
**By:** Claude Code Review
**Actions:** Created todo from PR #21 code review findings.

### 2026-02-14 - Fixed
**By:** Claude Code
**Actions:**
- Added column-count assertion (12) to notifications trigger (migration 000006)
- Placed after courier bypass, before field checks
- Raises descriptive exception with actual vs expected count on mismatch
