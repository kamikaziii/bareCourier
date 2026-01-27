---
status: ready
priority: p3
issue_id: "121"
tags: [reliability, edge-functions, code-review]
dependencies: []
---

# Theoretical Race Condition in check-past-due Concurrent Runs

## Problem Statement
`check-past-due` reads `last_past_due_notification_at`, dispatches notification, then updates the timestamp. If two invocations overlap (manual trigger + cron, or slow execution), the same service could be notified twice because both reads happen before either write.

## Findings
- Location: `supabase/functions/check-past-due/index.ts:202-238`
- Read at line 202, write at line 232-235 with dispatch in between
- Low probability for solo courier app but architecturally unsound
- Supabase cron can overlap if execution exceeds interval

## Proposed Solutions

### Option 1: Atomic claim-then-dispatch pattern
- Update timestamp FIRST with a WHERE condition, only dispatch if rows affected > 0
- **Pros**: Eliminates race window entirely
- **Cons**: Slightly different control flow
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Use optimistic locking: update `last_past_due_notification_at` with a WHERE clause checking the old value, then only dispatch if the update affected rows.

## Technical Details
- **Affected Files**: `supabase/functions/check-past-due/index.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Concurrent invocations cannot produce duplicate notifications for the same service
- [ ] Normal single-invocation behavior unchanged

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Second sweep code review of commit 158e99d. Low practical risk for solo courier app.
