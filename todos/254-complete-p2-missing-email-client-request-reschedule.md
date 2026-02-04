---
status: complete
priority: p2
issue_id: "254"
tags: [code-review, notifications, email, pr-13]
dependencies: []
---

# Missing Email Notifications in Client requestReschedule Action

## Problem Statement

When a client requests a reschedule (either requiring approval or auto-approved), the courier only receives an in-app notification. No email or push notification is sent.

Reschedule requests are time-sensitive and the courier should be notified via email to ensure timely response.

## Findings

**Source:** Manual code review of PR #13

**Location:** `src/routes/client/services/[id]/+page.server.ts`

**requestReschedule - needsApproval path (lines 174-183):**
```typescript
if (courierProfile?.id) {
  await supabase.from('notifications').insert({
    user_id: courierProfile.id,
    type: 'schedule_change',
    title: 'Pedido de Reagendamento',
    message: 'O cliente pediu para reagendar uma entrega.',
    service_id: params.id
  });
}
// NO EMAIL SENT
```

**requestReschedule - auto-approved path (lines 221-228):**
```typescript
if (courierProfile?.id) {
  await supabase.from('notifications').insert({
    user_id: courierProfile.id,
    type: 'schedule_change',
    title: 'Reagendamento Automático',
    message: 'Um cliente reagendou uma entrega automaticamente.',
    service_id: params.id
  });
}
// NO EMAIL SENT
```

**Impact:**
- Courier may miss time-sensitive reschedule requests
- Client may wait longer for response than necessary
- Inconsistent with other notification patterns in the app

## Proposed Solutions

### Solution 1: Use notifyCourier() for Both Paths (Recommended)
**Pros:** Consistent, sends email, respects preferences
**Cons:** Need to add new email templates or reuse existing ones
**Effort:** Small
**Risk:** Low

```typescript
// For needsApproval path:
await notifyCourier({
  supabase,
  session,
  serviceId: params.id,
  category: 'schedule_change',
  title: 'Pedido de Reagendamento',
  message: 'O cliente pediu para reagendar uma entrega. Requer a sua aprovação.',
  emailTemplate: 'reschedule_request',  // New or reuse existing
  emailData: {
    client_name: clientName,
    pickup_location: service.pickup_location,
    delivery_location: service.delivery_location,
    requested_date: newDate,
    reason: reason || '',
    app_url: APP_URL
  }
});

// For auto-approved path:
await notifyCourier({
  supabase,
  session,
  serviceId: params.id,
  category: 'schedule_change',
  title: 'Reagendamento Automático',
  message: 'Um cliente reagendou uma entrega automaticamente.',
  emailTemplate: 'reschedule_auto_approved',  // New or reuse existing
  emailData: { ... }
});
```

### Solution 2: Reuse Existing Email Template
**Pros:** No new template needed
**Cons:** Message may be slightly generic
**Effort:** Small
**Risk:** Low

Reuse `request_suggested` or similar template.

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/client/services/[id]/+page.server.ts`

**Actions to Update:**
- `requestReschedule` - needsApproval path (lines 140-185)
- `requestReschedule` - auto-approved path (lines 186-232)

**May Need:**
- New email templates in `supabase/functions/send-email/index.ts`
- New translations in `supabase/functions/_shared/email-translations.ts`

## Acceptance Criteria

- [ ] Courier receives email when client requests reschedule (needs approval)
- [ ] Courier receives email when client auto-reschedules
- [ ] Email contains relevant service details
- [ ] Uses notifyCourier() for consistency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 deep review | Direct notification inserts bypass email dispatch |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
