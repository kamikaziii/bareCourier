---
status: complete
priority: p2
issue_id: "256"
tags: [code-review, architecture, notifications, pr-13]
dependencies: ["253", "254", "255"]
---

# Inconsistent Notification Code Paths for Same Operations

## Problem Statement

The same user actions (accept suggestion, decline suggestion, request reschedule) have different notification behavior depending on which UI page they're invoked from.

This violates finding #219 (Duplicate Reschedule Code Paths) which was supposed to consolidate these paths.

## Findings

**Source:** Manual code review of PR #13

**Inconsistency Map:**

| Action | Via Dashboard | Via Service Detail |
|--------|--------------|-------------------|
| Client accepts suggestion | `notifyCourier()` → in-app + push + email | Direct insert → in-app only |
| Client declines suggestion | `notifyCourier()` → in-app + push + email | Direct insert → in-app only |
| Client requests reschedule | N/A | Direct insert → in-app only |
| Courier proposes reschedule | `notifyClient()` → in-app + push + email (suggest) | Direct insert → in-app only (reschedule w/ approval) |

**Files with Direct Notification Inserts (bypassing email):**
```bash
$ grep -n 'notifications.*\.insert' src/routes/client/services/[id]/+page.server.ts
176: await supabase.from('notifications').insert({
222: await supabase.from('notifications').insert({
263: await supabase.from('notifications').insert({
308: await supabase.from('notifications').insert({

$ grep -n 'notifications.*\.insert' src/routes/courier/services/[id]/+page.server.ts
280: await supabase.from('notifications').insert({
```

**Files correctly using notification service:**
- `src/routes/client/+page.server.ts` - Uses `notifyCourier()`
- `src/routes/courier/requests/+page.server.ts` - Uses `notifyClient()`
- `src/routes/courier/services/+page.server.ts` - Uses `notifyClient()`
- `src/routes/client/new/+page.server.ts` - Uses `notifyCourier()`

**Impact:**
- User experience varies based on navigation path
- Notification preferences (quiet hours, working days) not respected
- Email notifications missing from some paths
- Code maintenance burden with duplicate patterns

## Proposed Solutions

### Solution 1: Replace All Direct Inserts with Service Functions (Recommended)
**Pros:** Consistent behavior, centralized logic, respects preferences
**Cons:** Requires updating multiple files
**Effort:** Medium (5 locations)
**Risk:** Low

Replace all `supabase.from('notifications').insert()` calls with `notifyClient()` or `notifyCourier()`.

### Solution 2: Create Shared Action Handlers
**Pros:** Single source of truth, eliminates duplication
**Cons:** More significant refactoring
**Effort:** Large
**Risk:** Medium

Create shared server action handlers that both dashboard and detail pages use.

### Solution 3: Redirect Detail Page Actions to Dashboard
**Pros:** Zero duplication
**Cons:** May affect UX, requires navigation changes
**Effort:** Medium
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Files Needing Updates:**
- `src/routes/client/services/[id]/+page.server.ts` (4 direct inserts)
- `src/routes/courier/services/[id]/+page.server.ts` (1 direct insert)

**Pattern to Follow:**
See `src/routes/client/+page.server.ts` for correct pattern using `notifyCourier()`.

## Acceptance Criteria

- [ ] All notification paths use `notifyClient()` or `notifyCourier()`
- [ ] No direct `notifications.insert()` calls in route files
- [ ] Same action produces same notification regardless of UI path
- [ ] Email sent for all important notifications
- [ ] Notification preferences respected everywhere

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Finding #219 fix was incomplete |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Related: Finding #219 (Duplicate Reschedule Code Paths)
- Dependent findings: #253, #254, #255
