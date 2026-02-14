---
status: pending
priority: p2
issue_id: "344"
tags: [security, database, triggers, code-review]
dependencies: ["343"]
---

# No column-count safety check on services trigger

## Problem Statement

The profiles trigger (migration 000003) has a runtime column-count assertion that fails loudly if columns are added to the profiles table without updating the trigger. The services trigger lacks this same safety check. If new columns are added to the services table, they would silently pass through for client edits on non-pending services, potentially bypassing intended field restrictions.

## Findings

- **Location**: `supabase/migrations/20260213000004_fix_services_trigger_denylist_and_ordering.sql`
- **Current services table column count**: 54
- **Profiles trigger pattern** (in 000003): Checks `information_schema.columns` count and raises an exception if it doesn't match the expected value
- **Gap**: Services trigger has no equivalent check, so adding a new column silently allows client edits on that column for non-pending services

## Proposed Solutions

### Option 1: Add column-count assertion to services trigger (Recommended)
Add the same pattern used in the profiles trigger:

```sql
IF (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services') != 54
THEN
  RAISE EXCEPTION 'services table column count changed — update check_service_update_fields trigger (expected 54 columns)';
END IF;
```

- **Pros**: Fails loudly on schema changes, forces developer to audit trigger when adding columns
- **Cons**: Minor friction when adding columns (must update trigger too)
- **Effort**: Small
- **Risk**: Low

### Option 2: Use allowlist instead of denylist
Switch the trigger from a denylist approach to an allowlist, where only explicitly permitted columns can be modified by clients.
- **Pros**: More secure by default — new columns are blocked until explicitly allowed
- **Cons**: Larger refactor, higher risk of breaking existing functionality
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action
<!-- Filled during triage -->

## Technical Details

- **Affected Files**: `supabase/migrations/20260213000004_fix_services_trigger_denylist_and_ordering.sql`
- **Related Components**: Services trigger, schema migrations
- **Database Changes**: Yes — new migration to add column-count check to services trigger
- **Note**: Depends on todo 343 since both touch the same trigger; should be done together or sequentially

## Acceptance Criteria

- [ ] Services trigger includes column-count assertion matching current column count (54)
- [ ] Adding a column to services table without updating the trigger causes a loud failure
- [ ] Existing service update operations still work correctly

## Work Log

### 2026-02-14 - Discovered during PR #21 security review
**By:** Claude Code Review
**Actions:** Created todo from PR #21 code review findings.
