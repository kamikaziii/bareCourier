---
status: pending
priority: p2
issue_id: "269"
tags: [code-review, i18n, notifications, pr-13]
dependencies: []
---

# Hardcoded Portuguese Notification Titles in Server Routes

## Problem Statement

In-app notification titles throughout the server routes are hardcoded in Portuguese instead of using the i18n system. This means all users receive Portuguese notification titles regardless of their locale preference.

**Why it matters:**
- Inconsistent experience for English-speaking users
- Email templates use proper i18n via `emailT()`, but in-app notifications don't
- Breaks the i18n pattern established elsewhere in the codebase
- 21+ instances across multiple server files

## Findings

**Affected files and hardcoded titles:**

| File | Line | Hardcoded Title | English Translation |
|------|------|-----------------|---------------------|
| `courier/services/[id]/+page.server.ts` | 103 | 'Serviço Entregue' | Service Delivered |
| `courier/services/[id]/+page.server.ts` | 285 | 'Proposta de Reagendamento' | Reschedule Proposal |
| `courier/services/[id]/+page.server.ts` | 343 | 'Entrega Reagendada' | Delivery Rescheduled |
| `courier/requests/+page.server.ts` | 181 | 'Pedido Aceite' | Request Accepted |
| `courier/requests/+page.server.ts` | 255 | 'Pedido Rejeitado' | Request Rejected |
| `courier/requests/+page.server.ts` | 460 | 'Reagendamento Aprovado' | Reschedule Approved |
| `courier/requests/+page.server.ts` | 677 | 'Reagendamento Recusado' | Reschedule Denied |
| `client/+page.server.ts` | 307 | 'Sugestão Aceite' | Suggestion Accepted |
| `client/+page.server.ts` | 387 | 'Sugestão Recusada' | Suggestion Declined |
| `client/+page.server.ts` | 472 | 'Pedido Cancelado' | Request Cancelled |
| `client/services/[id]/+page.server.ts` | 191 | 'Pedido de Reagendamento' | Reschedule Request |
| `client/services/[id]/+page.server.ts` | 312 | 'Reagendamento Aceite' | Reschedule Accepted |
| `client/services/[id]/+page.server.ts` | 378 | 'Reagendamento Recusado' | Reschedule Denied |
| `client/new/+page.server.ts` | 253 | 'Novo Pedido de Serviço' | New Service Request |

**Note:** Email templates correctly use `emailT()` for i18n. Only in-app notification titles are affected.

## Proposed Solutions

### Option A: Use server-side i18n with user locale (Recommended)
**Pros:** Proper i18n, respects user preference
**Cons:** Need to fetch user locale in server actions
**Effort:** Medium
**Risk:** Low

```typescript
// Import server-side translations
import { t, getLocale } from '$lib/server/translations';

// In action, get target user's locale
const { data: targetProfile } = await supabase
  .from('profiles')
  .select('locale')
  .eq('id', clientId)
  .single();

const locale = getLocale(targetProfile?.locale);

await notifyClient({
  // ...
  title: t('notification_service_delivered', locale),
  message: t('notification_service_delivered_message', locale),
  // ...
});
```

### Option B: Pass locale through notification service
**Pros:** Centralized translation, cleaner action code
**Cons:** Requires notification service changes
**Effort:** Medium
**Risk:** Low

Add `titleKey` and `messageKey` to notification params, translate in `send-notification` edge function.

### Option C: Accept Portuguese for in-app (document as limitation)
**Pros:** No code change
**Cons:** Poor i18n support, inconsistent UX
**Effort:** None
**Risk:** None (already existing behavior)

## Recommended Action

Implement Option A - add i18n keys and use server-side translation with user locale.

## Technical Details

- **Affected files:** 6 server route files (see table above)
- **i18n files to update:**
  - `messages/en.json` - add notification title keys
  - `messages/pt-PT.json` - add notification title keys
- **New utility needed:** Server-side translation helper (or reuse from edge functions)
- **Total instances:** 21+ hardcoded titles

## Acceptance Criteria

- [ ] All notification titles use i18n keys
- [ ] EN and PT-PT translations provided
- [ ] Notifications respect user's locale preference
- [ ] Email templates remain unchanged (already correct)
- [ ] No regression in notification delivery

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-05 | Created from post-merge review of PRs #13-16 | Email i18n pattern not applied to in-app |

## Resources

- PR #13: https://github.com/kamikaziii/bareCourier/pull/13
- Edge function i18n: `supabase/functions/_shared/translations.ts`
- Email i18n: `supabase/functions/_shared/email-translations.ts`
