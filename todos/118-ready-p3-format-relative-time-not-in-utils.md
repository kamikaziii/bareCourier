---
status: ready
priority: p3
issue_id: "118"
tags: [code-quality, consistency, code-review]
dependencies: []
---

# formatRelativeTime Defined Locally Instead of utils.ts

## Problem Statement
`formatRelativeTime` is defined inside `NotificationBell.svelte:94-110` but all other date/time formatting functions (`formatDate`, `formatDateTime`, `formatDateShort`, `formatDateWithWeekday`, `formatDateFull`, `formatMonthYear`, `formatTimeSlot`) live in `src/lib/utils.ts`. This breaks the established pattern.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:94-110`
- Only used in NotificationBell currently
- All other formatters centralized in `src/lib/utils.ts`

## Proposed Solutions

### Option 1: Move to utils.ts
- **Pros**: Consistent with codebase pattern, reusable
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Move `formatRelativeTime` to `src/lib/utils.ts` and import in NotificationBell.

## Technical Details
- **Affected Files**: `src/lib/utils.ts`, `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `formatRelativeTime` lives in utils.ts
- [ ] NotificationBell imports it from utils

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Second sweep code review of commit 158e99d
