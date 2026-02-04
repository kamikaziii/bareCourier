---
status: pending
priority: p3
issue_id: "257"
tags: [code-review, architecture, code-quality, pr-13]
dependencies: ["256"]
---

# Direct Notification Inserts Bypass Centralized Dispatch Logic

## Problem Statement

Several files use direct `supabase.from('notifications').insert()` calls instead of the centralized `notifyClient()` / `notifyCourier()` service functions.

This bypasses:
- User notification preferences (quiet hours, working days, category preferences)
- Multi-channel dispatch (in-app, push, email)
- Email tracking columns (email_id, email_status, email_sent_at)

## Findings

**Source:** Manual code review of PR #13

**Files using direct inserts:**

1. `src/routes/client/services/[id]/+page.server.ts`
   - Line 176: requestReschedule (needsApproval)
   - Line 222: requestReschedule (auto-approved)
   - Line 263: acceptReschedule
   - Line 308: declineReschedule

2. `src/routes/courier/services/[id]/+page.server.ts`
   - Line 280: reschedule (pendingApproval)

**What direct inserts miss:**

```typescript
// Direct insert (current - incomplete):
await supabase.from('notifications').insert({
  user_id: recipientId,
  type: 'schedule_change',
  title: 'Title',
  message: 'Message',
  service_id: serviceId
});
// Missing: push notification, email, preference checks, tracking

// Service function (correct - complete):
await notifyCourier({
  supabase,
  session,
  serviceId,
  category: 'schedule_change',
  title: 'Title',
  message: 'Message',
  emailTemplate: 'template_name',
  emailData: { ... }
});
// Includes: preference checks, quiet hours, push, email, tracking
```

**Impact:**
- Inconsistent notification behavior
- Email tracking columns always null for these notifications
- User preferences ignored
- Harder to maintain and audit notification logic

## Proposed Solutions

### Solution 1: Establish Lint Rule / Code Review Checklist
**Pros:** Prevents future occurrences
**Cons:** Doesn't fix existing issues
**Effort:** Small
**Risk:** Low

Add to CLAUDE.md or code review checklist:
> Never use direct `notifications.insert()` in route files. Always use `notifyClient()` or `notifyCourier()` from `$lib/services/notifications.js`.

### Solution 2: Create Architectural Decision Record (ADR)
**Pros:** Documents rationale, guides future development
**Cons:** Doesn't fix existing code
**Effort:** Small
**Risk:** Low

Document the notification architecture decision.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Centralized notification service:**
- `src/lib/services/notifications.ts` - Client-side wrappers
- `supabase/functions/_shared/notify.ts` - Server-side dispatch logic
- `supabase/functions/send-notification/index.ts` - Edge function endpoint

**Correct import pattern:**
```typescript
import { notifyClient, notifyCourier } from '$lib/services/notifications.js';
import { APP_URL } from '$lib/constants.js';
```

## Acceptance Criteria

- [ ] Document notification architecture in CLAUDE.md or ADR
- [ ] Add to code review checklist
- [ ] All existing direct inserts replaced (via #253, #254, #255)
- [ ] Future PRs checked for this anti-pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Pattern emerged across multiple files |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Notification service: `src/lib/services/notifications.ts`
- Dispatch logic: `supabase/functions/_shared/notify.ts`
