---
status: complete
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

### Option 1: Fire-and-forget with error logging
Remove `await` from notification calls but add `.catch()` for error logging:
```typescript
notifyClient({ ... }).catch(err => console.error('Notification failed:', err));
```
- **Pros**: Immediate response, notifications still sent
- **Cons**: No guarantee notification succeeded before response
- **Effort**: Small
- **Risk**: **HIGH on Vercel** — un-awaited promises in serverless functions may be CANCELLED when the response is sent and the function terminates. This would silently break notifications.

### Option 2: Use Vercel waitUntil() (Recommended)
Use Vercel's `waitUntil()` API to keep the serverless function alive for background work:
```typescript
// In server action
import { waitUntil } from '@vercel/functions';
waitUntil(notifyClient({ ... }).catch(err => console.error('Notification failed:', err)));
```
- **Pros**: Immediate response, notifications reliably sent, Vercel-native
- **Cons**: Vercel-specific API, adds dependency
- **Effort**: Small
- **Risk**: Low

### Option 3: Use Supabase database webhooks
Move notification dispatch to a database trigger/webhook so it's completely decoupled.
- **Pros**: Fully decoupled, retryable
- **Cons**: Larger architectural change
- **Effort**: Large
- **Risk**: Medium

## Recommended Action
Option 2: Vercel `waitUntil()` — implemented via `backgroundNotify()` helper.

## Technical Details
- **Affected Files**: Multiple `+page.server.ts` files
- **Related Components**: `$lib/services/notifications.ts`

## Acceptance Criteria
- [x] Server actions return faster
- [x] Notifications still sent reliably (via Vercel waitUntil)
- [x] Errors are logged (notifyClient/notifyCourier have internal error handling)

## Work Log

### 2026-02-13 - Created from PR #21 Review
**By:** Claude Code Review
**Actions:**
- Identified by performance-oracle agent

### 2026-02-13 - Updated after verification
**By:** Claude Code (verification pass)
**Actions:**
- Confirmed 16 await locations across 5 route files
- Confirmed functions make HTTP edge function calls (not just DB inserts)
- CRITICAL: Downgraded Option 1 (simple fire-and-forget) — unsafe on Vercel serverless, un-awaited promises may be cancelled
- Added Option 2 (Vercel waitUntil) as recommended approach

## Resources
- PR: https://github.com/kamikaziii/bareCourier/pull/21

### 2026-02-13 - Implemented Option 2
**By:** Claude Code
**Actions:**
- Installed `@vercel/functions` (v3.4.2)
- Added `backgroundNotify()` helper to `src/lib/services/notifications.ts` using `waitUntil()`
- Converted all 16 notification call sites across 5 route files:
  - `src/routes/client/+page.server.ts` (4 calls + sendBatchNotification helper)
  - `src/routes/client/services/[id]/+page.server.ts` (3 calls)
  - `src/routes/client/new/+page.server.ts` (1 call)
  - `src/routes/courier/services/[id]/+page.server.ts` (3 calls)
  - `src/routes/courier/requests/+page.server.ts` (5 simple + 1 batch)
- Build verified: `pnpm run check` passes with 0 errors
