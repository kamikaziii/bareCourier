---
status: pending
priority: p2
issue_id: "317"
tags: [security, database, triggers, code-review]
dependencies: ["334"]
---

# Profile update trigger is denylist claiming to be allowlist — new columns unprotected by default

## Problem Statement

Migration 000003 creates a BEFORE UPDATE trigger on the `profiles` table that restricts which columns clients can update. The trigger comment and variable names say "allowlist" but the implementation is actually a **denylist** — it checks `IF NEW.column IS DISTINCT FROM OLD.column THEN RAISE EXCEPTION`. This means any NEW column added to the `profiles` table in the future will be modifiable by clients unless explicitly added to the trigger's deny list.

This is a **future maintenance risk**, not an active vulnerability — all current sensitive columns are covered (except `email` which doesn't exist on profiles, tracked in #334). Downgraded from P1 to P2 because the current column set is protected.

Additionally, the comment at line 151 references non-existent columns `push_subscription` and `push_enabled` — the actual column is `push_notifications_enabled`.

## Findings

- Trigger function `fn_restrict_client_profile_updates()` in migration 000003
- Code checks each sensitive column individually and raises exception if changed
- If a developer adds a new sensitive column (e.g., `is_admin`) and forgets to update the trigger, clients can modify it
- The services trigger in migration 000004 has the SAME pattern (denylist) but covers all 55 columns, so the gap is smaller there
- Comment in code says "allowlist" which is misleading
- **All currently existing sensitive columns ARE covered** — this is a future risk, not an active gap
- Comment at line 151 says "push_subscription, push_enabled" but actual column is `push_notifications_enabled`

**Location:** `supabase/migrations/20260213000003_add_profile_update_trigger.sql`

## Proposed Solutions

### Option 1: Convert to true allowlist (Recommended)
Instead of checking each denied column, define allowed columns and reject changes to anything else.
- **Pros**: New columns blocked by default, truly secure
- **Cons**: More complex SQL, needs testing
- **Effort**: Medium
- **Risk**: Medium (must not break existing client updates)

### Option 2: Fix comments, add checklist note, fix column name references
Keep denylist but fix misleading comments and incorrect column names in comments.
- **Pros**: Minimal change, addresses confusion
- **Cons**: Still relies on developer remembering to update trigger
- **Effort**: Small
- **Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: `supabase/migrations/20260213000003_add_profile_update_trigger.sql`
- **Related Components**: Profile update flows for clients
- **Database Changes**: Yes - rewrite trigger function

## Acceptance Criteria
- [ ] Trigger correctly blocks modifications to sensitive columns
- [ ] New columns added to profiles table are blocked by default (if allowlist chosen)
- [ ] Comments accurately describe the approach used
- [ ] Column name references in comments match actual column names
- [ ] Client can still update their allowed fields (name, phone, etc.)

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by security-sentinel, code-simplicity-reviewer, and data-integrity-guardian agents
- Cross-confirmed by pattern-recognition-specialist

### 2026-02-13 - Downgraded from P1 to P2 during verification
**By:** Claude Code Review (verification pass)
**Actions:**
- Verified all currently existing sensitive columns ARE covered in the denylist
- Downgraded from P1 to P2: future maintenance risk, not active vulnerability
- Added dependency on #334 (email column bug must be fixed first)
- Noted incorrect column names in comments (push_subscription/push_enabled vs push_notifications_enabled)

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
- Migration 000003 (profile trigger)
- Migration 000004 (services trigger - same pattern but more complete)
