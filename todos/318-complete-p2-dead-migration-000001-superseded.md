---
status: complete
priority: p2
issue_id: "318"
tags: [database, cleanup, code-review]
dependencies: []
---

# Migration 000001 is dead code — superseded by 000004

## Problem Statement

Migration `000001_fix_trigger_restore_pending_edit.sql` (123 lines) creates a services update trigger that is completely replaced by migration `000004_fix_services_trigger_denylist_and_ordering.sql` (296 lines). Migration 000004 drops and recreates the same trigger with a more comprehensive implementation covering all 55 columns. Running 000001 only to have it immediately overwritten by 000004 is wasteful and confusing.

## Findings

- 000001 creates `fn_restrict_service_updates` trigger
- 000004 uses `DROP FUNCTION IF EXISTS` then recreates with same name
- The intermediate state (after 000001, before 000004) is never meaningful in production
- 123 lines of dead migration code

**Location:** `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql`

## Proposed Solutions

### Option 1: Squash into 000004 (Recommended)
Remove migration 000001 content (make it empty or a no-op comment), since 000004 handles everything.
- **Pros**: Removes confusion, cleaner migration history
- **Cons**: Cannot modify already-applied migrations in production
- **Effort**: Small
- **Risk**: Low (only if migrations haven't been applied to production yet)

### Option 2: Add comment explaining supersession
Add a comment at top of 000001 noting it's superseded.
- **Pros**: No migration changes needed
- **Cons**: Dead code remains
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql`
- **Related Components**: Migration 000004
- **Database Changes**: Potentially (squash)

## Acceptance Criteria
- [ ] Migration history is clean and non-confusing
- [ ] No functional regression

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Flagged by all 6 review agents as dead code

### 2026-02-13 - Closed after verification
**By:** Claude Code (verification pass)
**Reason:** Cannot modify already-applied Supabase migrations. 000001 is a necessary intermediate step in the migration chain — removing it would break migration history. Not actionable.

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
