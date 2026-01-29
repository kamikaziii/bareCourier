---
status: complete
priority: p2
issue_id: "111"
tags: [performance, edge-functions, code-review]
dependencies: []
---

# N+1 Profile Query in check-past-due Dispatch Loop

## Problem Statement
`check-past-due/index.ts:216-238` calls `dispatchNotification()` in a loop per overdue service. Each call loads the courier's profile from the database (`notify.ts:101-107`), even though all dispatches target the same courier. N overdue services = N identical profile SELECTs.

## Findings
- Location: `supabase/functions/check-past-due/index.ts:216-238`
- `dispatchNotification()` at `notify.ts:101-107` SELECTs profile on every call
- All dispatches in check-past-due target the same `courier.id`
- For 10 overdue services: 10 identical profile queries + 10 notification inserts + up to 20 HTTP fetches

## Proposed Solutions

### Option 1: Accept pre-fetched profile in dispatchNotification
- **Pros**: Eliminates redundant queries, backward compatible with optional param
- **Cons**: Changes function signature
- **Effort**: Small
- **Risk**: Low

### Option 2: Add profile caching inside dispatchNotification
- **Pros**: No caller changes needed
- **Cons**: Cache lifetime management, adds complexity
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action
Option 1: Add optional `profile` parameter to `DispatchParams`. If provided, skip the SELECT. Update `check-past-due` to fetch profile once before the loop and pass it in.

## Technical Details
- **Affected Files**: `supabase/functions/_shared/notify.ts`, `supabase/functions/check-past-due/index.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Profile is fetched once per check-past-due invocation, not per service
- [ ] dispatchNotification still works without pre-fetched profile (backward compatible)
- [ ] daily-summary continues working unchanged

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
