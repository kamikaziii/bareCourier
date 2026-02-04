---
status: complete
priority: p2
issue_id: "253"
tags: [code-review, notifications, email, pr-13]
dependencies: []
---

# Missing Email Notifications in Client Service Detail acceptReschedule/declineReschedule

## Problem Statement

When a client accepts or declines a courier's reschedule suggestion from the service detail page (`/client/services/[id]`), the courier only receives an in-app notification. No email or push notification is sent.

This is inconsistent with the same actions performed from the client dashboard (`/client`), which correctly uses `notifyCourier()` to send in-app + push + email.

## Findings

**Source:** Manual code review of PR #13

**Location:** `src/routes/client/services/[id]/+page.server.ts`

**acceptReschedule (lines 262-270) - In-app only:**
```typescript
await supabase.from('notifications').insert({
  user_id: (courierData as { id: string }).id,
  type: 'schedule_change',
  title: 'Reagendamento Aceite',
  message: 'O cliente aceitou a proposta de reagendamento.',
  service_id: params.id
});
```

**declineReschedule (lines 306-315) - In-app only:**
```typescript
await supabase.from('notifications').insert({
  user_id: (courierData as { id: string }).id,
  type: 'schedule_change',
  title: 'Reagendamento Recusado',
  message: `O cliente recusou a proposta de reagendamento.${reasonText}`,
  service_id: params.id
});
```

**Compare to client/+page.server.ts acceptSuggestion (line 281):**
```typescript
await notifyCourier({
  supabase,
  session,
  serviceId,
  category: 'schedule_change',
  title: 'Sugestão Aceite',
  message: 'O cliente aceitou a data sugerida para o serviço.',
  emailTemplate: 'suggestion_accepted',  // ✅ Sends email
  emailData: { ... }
});
```

**Grep confirmation:**
```bash
$ grep 'notifyCourier|notifyClient' src/routes/client/services/[id]/+page.server.ts
No matches found
```

**Impact:**
- Courier may miss important schedule confirmations if not actively checking app
- Inconsistent notification behavior depending on which UI path client uses
- Time-sensitive decisions may be delayed

## Proposed Solutions

### Solution 1: Replace Direct Inserts with notifyCourier() (Recommended)
**Pros:** Consistent behavior, respects notification preferences, sends email
**Cons:** Requires adding imports and session handling
**Effort:** Small
**Risk:** Low

```typescript
import { notifyCourier } from '$lib/services/notifications.js';
import { APP_URL } from '$lib/constants.js';

// In acceptReschedule:
await notifyCourier({
  supabase,
  session,
  serviceId: params.id,
  category: 'schedule_change',
  title: 'Reagendamento Aceite',
  message: 'O cliente aceitou a proposta de reagendamento.',
  emailTemplate: 'suggestion_accepted',
  emailData: {
    client_name: clientName,
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    new_date: formattedDate,
    service_id: params.id,
    app_url: APP_URL
  }
});
```

### Solution 2: Consolidate to Single Code Path
**Pros:** Eliminates duplicate code entirely
**Cons:** More refactoring needed
**Effort:** Medium
**Risk:** Low

Redirect both UI paths to use the same server action.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/client/services/[id]/+page.server.ts`

**Actions to Update:**
- `acceptReschedule` (lines 235-273)
- `declineReschedule` (lines 275-318)

**Required Imports:**
```typescript
import { notifyCourier } from '$lib/services/notifications.js';
import { APP_URL } from '$lib/constants.js';
```

## Acceptance Criteria

- [ ] acceptReschedule uses notifyCourier() with emailTemplate
- [ ] declineReschedule uses notifyCourier() with emailTemplate
- [ ] Courier receives email when client accepts/declines from service detail page
- [ ] Behavior matches client dashboard actions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Same operation has different behavior based on UI path |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
- Related: Finding #219 (Duplicate Reschedule Code Paths)
