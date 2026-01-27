---
status: complete
priority: p3
issue_id: "122"
tags: [race-condition, async, code-review]
dependencies: []
---

# No Cancellation Token for Async loadNotifications in $effect

## Problem Statement
`NotificationBell.svelte:140-141` calls async `loadNotifications()` inside `$effect` without a cancellation token. If the effect re-runs (e.g., dependency change, hot reload), a stale response from the first call can overwrite fresher data from the second call or from real-time inserts that arrived in between.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:140-141`
- `loadNotifications()` sets `notifications = data` at line 75
- No `let canceled = false` / `if (canceled) return` pattern
- Effect cleanup only removes the channel subscription, not in-flight fetches

## Proposed Solutions

### Option 1: Add cancellation flag to effect
- Add `let canceled = false` at top of effect, check before assignment, set true in cleanup
- **Pros**: Standard async effect pattern, prevents stale overwrites
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add cancellation token. Pass it to loadNotifications or check it after the await.

## Technical Details
- **Affected Files**: `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Stale async responses do not overwrite fresh notification data
- [ ] Effect cleanup cancels in-flight loads

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Third sweep code review of commit 158e99d (frontend races)
