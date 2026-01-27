---
status: ready
priority: p3
issue_id: "123"
tags: [ux, async, code-review]
dependencies: []
---

# handleNotificationClick Awaits markAsRead Before Closing Dropdown

## Problem Statement
`NotificationBell.svelte:129-138` awaits `markAsRead()` (DB roundtrip) before closing the dropdown and navigating. This causes a perceptible 50-200ms delay where the user clicks but nothing visibly happens.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:129-138`
- `await markAsRead(notification.id)` blocks at line 130
- Dropdown close (`open = false`) at line 135 happens AFTER the await
- Navigation (`goto()`) at line 136 also waits
- `markAsRead` does both DB update and optimistic local update (line 82)

## Proposed Solutions

### Option 1: Fire-and-forget markAsRead, close and navigate immediately
- Close dropdown first, fire markAsRead without await, then navigate
- **Pros**: Instant visual feedback, markAsRead still completes in background
- **Cons**: If markAsRead fails, notification stays unread server-side (minor)
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Reorder: close dropdown immediately, fire markAsRead without await, then navigate.

## Technical Details
- **Affected Files**: `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Clicking a notification closes dropdown and navigates without perceptible delay
- [ ] Notification still gets marked as read server-side

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Third sweep code review of commit 158e99d (frontend races)
