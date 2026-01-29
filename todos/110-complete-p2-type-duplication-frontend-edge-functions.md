---
status: complete
priority: p2
issue_id: "110"
tags: [architecture, maintainability, code-review]
dependencies: []
---

# Type and Default Duplication Across Frontend and Edge Functions

## Problem Statement
`NotificationPreferences`, `ChannelPreferences`, and `NotificationCategory` types are defined identically in both `src/lib/database.types.ts:34-56` and `supabase/functions/_shared/notify.ts:3-24`. Default preferences are also duplicated in `constants/scheduling.ts:37-51` and `notify.ts:43-53`. These will drift silently with no warning.

## Findings
- `database.types.ts:34-56` and `notify.ts:3-24` have identical type definitions
- `DEFAULT_NOTIFICATION_PREFERENCES` in `scheduling.ts:37-51` duplicated as `DEFAULT_PREFS` in `notify.ts:43-53`
- Edge functions run in Deno and cannot import from `src/lib/`, so duplication is architecturally necessary
- No comments linking the two locations

## Proposed Solutions

### Option 1: Add SYNC WARNING comments to both files
- **Pros**: Zero effort, prevents accidental drift
- **Cons**: Relies on developer discipline
- **Effort**: Small
- **Risk**: Low

### Option 2: Shared types in `supabase/functions/_shared/types.ts` with re-export from frontend
- **Pros**: Single source of truth
- **Cons**: Requires import path setup, may not work across Deno/Node boundary
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action
Option 1: Add `// SYNC: This type must match supabase/functions/_shared/notify.ts` comments in both files and vice versa.

## Technical Details
- **Affected Files**: `src/lib/database.types.ts`, `src/lib/constants/scheduling.ts`, `supabase/functions/_shared/notify.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Both type definition locations have sync warning comments referencing the other
- [ ] Both default preference locations have sync warning comments

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
