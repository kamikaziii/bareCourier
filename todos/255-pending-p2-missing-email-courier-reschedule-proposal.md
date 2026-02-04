---
status: pending
priority: p2
issue_id: "255"
tags: [code-review, notifications, email, pr-13]
dependencies: []
---

# Missing Email Notification for Courier's Reschedule Proposal to Client

## Problem Statement

When a courier proposes a reschedule that requires client approval (from the service detail page), the client only receives an in-app notification. No email is sent.

This is inconsistent with the courier's "suggest" action from the requests page, which correctly uses `notifyClient()` to send email.

## Findings

**Source:** Manual code review of PR #13

**Location:** `src/routes/courier/services/[id]/+page.server.ts:280`

**Current code (in-app only):**
```typescript
// Notify client
const formattedDate = formatDatePtPT(newDate);
const reasonText = reason ? ` Motivo: ${reason}` : '';
await supabase.from('notifications').insert({
  user_id: service.client_id,
  type: 'schedule_change',
  title: 'Proposta de Reagendamento',
  message: `O estafeta propõe reagendar para ${formattedDate}.${reasonText}`,
  service_id: params.id
});
// NO EMAIL SENT
```

**Compare to courier/requests/+page.server.ts suggest action (lines 375-394):**
```typescript
await notifyClient({
  session,
  clientId: service.client_id,
  serviceId,
  category: 'schedule_change',
  title: msg.subject,
  message: msg.body,
  emailTemplate: 'request_suggested',  // ✅ Sends email
  emailData: {
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    requested_date: service.requested_date || '',
    suggested_date: suggestedDate,
    app_url: APP_URL
  }
});
```

**Impact:**
- Client may miss important reschedule proposals requiring their action
- Time-sensitive decisions delayed if client doesn't check app
- Inconsistent behavior between "suggest" and "reschedule with approval" flows

## Proposed Solutions

### Solution 1: Replace Direct Insert with notifyClient() (Recommended)
**Pros:** Consistent, sends email, respects client preferences
**Cons:** Requires imports
**Effort:** Small
**Risk:** Low

```typescript
import { notifyClient } from '$lib/services/notifications.js';
import { APP_URL } from '$lib/constants.js';

// Replace direct insert with:
await notifyClient({
  session,
  clientId: service.client_id,
  serviceId: params.id,
  category: 'schedule_change',
  title: 'Proposta de Reagendamento',
  message: `O estafeta propõe reagendar para ${formattedDate}.${reasonText}`,
  emailTemplate: 'request_suggested',  // Reuse existing template
  emailData: {
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    requested_date: service.scheduled_date || '',
    suggested_date: newDate,
    app_url: APP_URL
  }
});
```

### Solution 2: Create Dedicated Email Template
**Pros:** More specific messaging
**Cons:** Additional template maintenance
**Effort:** Medium
**Risk:** Low

Create `reschedule_proposal` template distinct from `request_suggested`.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/courier/services/[id]/+page.server.ts`

**Action to Update:**
- `reschedule` action, pendingApproval path (around line 280)

**Required Imports:**
```typescript
import { notifyClient } from '$lib/services/notifications.js';
import { APP_URL } from '$lib/constants.js';
```

## Acceptance Criteria

- [ ] Client receives email when courier proposes reschedule requiring approval
- [ ] Email contains reschedule details and reason
- [ ] Uses notifyClient() for consistency
- [ ] Behavior matches courier "suggest" action from requests page

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Same conceptual action has different notification paths |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Compare: `src/routes/courier/requests/+page.server.ts` suggest action
