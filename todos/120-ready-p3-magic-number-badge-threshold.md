---
status: ready
priority: p3
issue_id: "120"
tags: [code-quality, consistency, code-review]
dependencies: []
---

# Badge Uses Magic Number 9 Instead of formatBadge Utility

## Problem Statement
`NotificationBell.svelte:175` uses `{unreadCount > 9 ? '9+' : unreadCount}` inline instead of the existing `formatBadge` utility from `$lib/utils.ts` which is already used by `MobileBottomNav`, `MoreDrawer`, and `SidebarItem`.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:175`
- `formatBadge(count, max)` exists at `src/lib/utils.ts:135-139`
- `MobileBottomNav.svelte:29` already uses `formatBadge(count, 9)` for the same max
- Inconsistency: other badges default to max 99, notification bell uses 9

## Proposed Solutions

### Option 1: Use formatBadge utility
- Replace inline logic with `formatBadge(unreadCount, 9)`
- **Pros**: Consistent with rest of codebase, single source of truth
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Import and use `formatBadge` from utils.ts.

## Technical Details
- **Affected Files**: `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Badge rendering uses `formatBadge` utility
- [ ] No inline magic number for badge threshold

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Second sweep code review of commit 158e99d
