---
status: ready
priority: p3
issue_id: "117"
tags: [reliability, memory, code-review]
dependencies: []
---

# Unbounded Real-time Array Growth in NotificationBell

## Problem Statement
`NotificationBell.svelte:155` prepends new notifications from real-time subscription without limit or deduplication. If the tab stays open, the array grows unbounded. A race between initial load and subscription activation could also produce duplicates.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:154-156`
- `notifications = [payload.new as Notification, ...notifications]` - no bounds, no dedup
- Initial query limits to 20 items, but real-time inserts bypass this

## Proposed Solutions

### Option 1: Add dedup check and slice to limit
- Add `if (notifications.some(n => n.id === newNotif.id)) return;`
- Add `.slice(0, 20)` after prepend
- **Pros**: Simple, matches query limit
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Add deduplication by ID and enforce max length of 20 after prepend.

## Technical Details
- **Affected Files**: `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Duplicate notifications are not shown
- [ ] Array never exceeds 20 items in memory

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Second sweep code review of commit 158e99d
