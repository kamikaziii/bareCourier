---
status: pending
priority: p2
issue_id: "319"
tags: [performance, server-actions, code-review]
dependencies: []
---

# Email notification calls block server actions — should be fire-and-forget

## Problem Statement

In several SvelteKit server actions, `notifyClient()` and `notifyCourier()` calls are awaited, meaning the user must wait for the email/notification to be sent before the action completes. Since notification delivery is not critical to the action's success, these should be fire-and-forget to improve response times.

## Findings

- `notifyClient()` and `notifyCourier()` make HTTP calls to Supabase edge functions
- Edge function calls can take 500ms-2s depending on email provider latency
- User waits for this even though the core action (DB update) already succeeded
- Multiple server actions in courier and client routes have this pattern

**Location:** Multiple `+page.server.ts` files in courier and client routes

## Proposed Solutions

### Option 1: Fire-and-forget with error logging (Recommended)
Remove `await` from notification calls but add `.catch()` for error logging:
```typescript
notifyClient({ ... }).catch(err => console.error('Notification failed:', err));
```
- **Pros**: Immediate response, notifications still sent
- **Cons**: No guarantee notification succeeded before response
- **Effort**: Small
- **Risk**: Low (notifications are best-effort anyway)

### Option 2: Use Supabase database webhooks
Move notification dispatch to a database trigger/webhook so it's completely decoupled.
- **Pros**: Fully decoupled, retryable
- **Cons**: Larger architectural change
- **Effort**: Large
- **Risk**: Medium

## Recommended Action
<!-- Filled during triage -->

## Technical Details
- **Affected Files**: Multiple `+page.server.ts` files
- **Related Components**: `$lib/services/notifications.ts`

## Acceptance Criteria
- [ ] Server actions return faster
- [ ] Notifications still sent reliably
- [ ] Errors are logged

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by performance-oracle agent

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21
