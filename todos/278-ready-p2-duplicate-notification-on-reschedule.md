---
status: ready
priority: p2
issue_id: "278"
tags: [bug, notifications, reschedule]
dependencies: []
---

# Duplicate In-App Notification on Courier Reschedule

## Problem Statement
The reschedule flow creates two in-app notifications: the `reschedule_service` RPC inserts one (migration line 127-139), then `notifyClient()` calls `send-notification` → `dispatchNotification()` which inserts another (notify.ts:145-156). Client receives duplicate notifications.

## Findings
- Location: `src/routes/courier/services/[id]/+page.server.ts:322-359`
- RPC INSERT: `20260205000002_fix_rpc_exception_rollback.sql:126-139`
- dispatchNotification INSERT: `supabase/functions/_shared/notify.ts:145-156`
- RPC has guard: `IF p_notification_title IS NOT NULL` (line 126)

## Proposed Solutions

### Option 1: Pass NULL title to RPC so it skips its INSERT
- At `+page.server.ts:328-329`, pass `undefined` for `p_notification_title` and `p_notification_message`
- RPC's conditional at line 126 will skip the INSERT
- `notifyClient()` handles the full notification (in-app + push + email)
- **Pros**: Minimal change, uses existing guard
- **Cons**: None
- **Effort**: Small (15 minutes)
- **Risk**: Low

## Recommended Action
Pass `undefined` for notification params in RPC call. Let `notifyClient()` handle all notification channels.

## Technical Details
- **Affected Files**: `src/routes/courier/services/[id]/+page.server.ts`
- **Related Components**: Reschedule flow, notification system
- **Database Changes**: No

## Acceptance Criteria
- [ ] Only one in-app notification per reschedule action
- [ ] Push and email notifications still sent
- [ ] Notification content is correct

## Work Log

### 2026-02-06 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Comprehensive audit session on 2026-02-06
