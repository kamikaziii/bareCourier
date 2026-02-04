# feat: Implement Toast Notification System

## Overview

Implement a toast notification system using **svelte-sonner** integrated with **shadcn-svelte** to provide non-blocking user feedback for actions throughout the bareCourier PWA.

**Type**: Enhancement
**Priority**: P1 (Must-Have)
**Scope**: Full implementation (~24 files, replace legacy inline banners + add missing feedback)

---

## Key Decisions (from review)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All files including client-side (~24 files) | Complete migration in one PR |
| i18n | Pre-define all keys | EN + PT-PT translations upfront |
| Error duration | Errors persist, success auto-closes (4s) | Critical errors need acknowledgment |
| Helper utility | `withToast()` wrapper | Type-safe Supabase operations |
| Legacy banners | Remove and replace | Toasts supersede inline success/error |
| Validation errors | Keep inline | Field-specific context matters |
| Login page | Keep inline errors | Auth is special case, errors stay near form |
| NotificationBell | Keep silent | Micro-interactions don't need confirmation |
| Calendar pages | Defer to later PR | Low priority, keep scope focused |
| Batch operations | Summary toast | "5 updated" not 5 separate toasts |

---

## Problem Statement / Motivation

### Current State

The application uses **inline error/success messages** in forms across 28+ files. This pattern has limitations:

1. **No confirmation for successful operations** - Users are redirected without explicit feedback
2. **Inconsistent feedback patterns** - Some forms show success, others just redirect
3. **Poor visibility** - Inline messages can be missed, especially after form submission + scroll
4. **No action recovery** - No retry/undo capabilities for failed operations
5. **No async operation feedback** - Loading states don't clearly communicate progress

### Evidence

| File | Pattern | Issue |
|------|---------|-------|
| `src/routes/login/+page.svelte:79-85` | Inline error banner | `bg-destructive/10` banner |
| `src/routes/courier/clients/new/+page.svelte:221-233` | Success/warning banners | Multiple conditional banners |
| `src/lib/components/PasswordChangeForm.svelte:72-79` | Success + delayed redirect | `setTimeout(() => goto(...), 2000)` |
| `src/routes/courier/settings/AccountTab.svelte` | Form submission | No visible success feedback |
| `src/routes/courier/services/+page.svelte` | Batch operations | `batchMessage` state with manual clearing |

### Why Toasts?

- **Non-blocking** - Don't interrupt user workflow
- **Consistent** - Same pattern everywhere
- **Actionable** - Can include Retry/Undo buttons
- **Accessible** - Proper ARIA live regions
- **Persistent where needed** - Errors stay until acknowledged

---

## Proposed Solution

### Technology Choice: svelte-sonner via shadcn-svelte

| Criteria | svelte-sonner | svelte-toast |
|----------|---------------|--------------|
| Svelte 5 support | Full (runes, snippets) | Basic |
| shadcn-svelte integration | Official component | Manual |
| Promise handling | Built-in `toast.promise()` | Manual |
| Bundle size | ~8.4 kB | ~8 kB |
| Accessibility | ARIA live regions built-in | Basic |
| Monthly downloads | ~400k | ~50k |

**Decision**: Use `svelte-sonner` via `shadcn-svelte add sonner`

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    +layout.svelte                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │OfflineInd.  │  │ ReloadPrompt │  │     <Toaster />     │ │
│  │  (top)      │  │              │  │  (bottom-right)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              toast() API (svelte-sonner)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ success  │ │  error   │ │ warning  │ │   promise     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              withToast() helper (src/lib/utils/toast.ts)    │
│  - Wraps Supabase operations                                │
│  - Loading → success/error transitions                      │
│  - Error toasts persist (duration: Infinity)                │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: Toast Positioning
**Decision:** `bottom-right`
**Rationale:**
- Doesn't conflict with `OfflineIndicator` (fixed at top)
- Mobile-friendly (above keyboard/nav)
- Standard PWA convention
- Doesn't obscure primary content

### D2: Toast Duration
**Decision:**
| Type | Duration | Behavior |
|------|----------|----------|
| Success | 4 seconds | Auto-dismiss |
| Error | `Infinity` | Manual dismiss required |
| Warning | 6 seconds | Auto-dismiss |
| Loading | Until resolved | Transitions to success/error |

**Rationale:** Critical errors need acknowledgment; success is just confirmation.

### D3: OfflineIndicator Coexistence
**Decision:** Keep `OfflineIndicator` as separate component
**Rationale:**
- Different purpose (persistent network status vs transient feedback)
- Different positioning (top banner vs bottom-right stack)
- Already working well with service worker
- No conflict in z-index or visual space

### D4: Toast Stacking
**Decision:** Stack vertically, max 3 visible
**Rationale:**
- Prevents overwhelming user
- Old toasts collapse behind newer ones
- Matches svelte-sonner default behavior
- Mobile-friendly (doesn't consume too much screen)

### D5: Batch Operation Toasts
**Decision:** Summary toast, not individual
**Rationale:**
- "5 services updated" instead of 5 separate toasts
- Include failure count if applicable: "3 succeeded, 2 failed"
- Prevents toast spam during bulk operations

### D6: Inline vs Toast Errors
**Decision:** Keep field validation inline, use toasts for async operations
**Rationale:**
| Error Type | Display | Example |
|------------|---------|---------|
| Field validation | Inline near field | "Email is required" |
| Server/network | Toast | "Failed to save" |
| Authentication | Toast | "Session expired" |
| Batch operations | Toast | "5 of 7 updated" |

---

## Implementation Tasks

### Phase 1: Foundation

#### Task 1.1: Install svelte-sonner component
```bash
pnpm dlx shadcn-svelte@latest add sonner --yes
```

**Creates:**
- `src/lib/components/ui/sonner/index.ts`
- `src/lib/components/ui/sonner/sonner.svelte`

#### Task 1.2: Fix sonner.svelte for projects without mode-watcher

The default shadcn-svelte sonner component imports `mode-watcher`, but this project doesn't use it.

**File:** `src/lib/components/ui/sonner/sonner.svelte`

```svelte
<script lang="ts">
  import { Toaster as Sonner, type ToasterProps } from "svelte-sonner";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import InfoIcon from "@lucide/svelte/icons/info";
  import Loader2Icon from "@lucide/svelte/icons/loader-2";
  import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

  let { ...restProps }: ToasterProps = $props();
</script>

<Sonner
  theme="light"
  class="toaster group"
  style="--normal-bg: var(--color-popover); --normal-text: var(--color-popover-foreground); --normal-border: var(--color-border);"
  {...restProps}
>
  {#snippet loadingIcon()}
    <Loader2Icon class="size-4 animate-spin" />
  {/snippet}
  {#snippet successIcon()}
    <CircleCheckIcon class="size-4" />
  {/snippet}
  {#snippet errorIcon()}
    <OctagonXIcon class="size-4" />
  {/snippet}
  {#snippet infoIcon()}
    <InfoIcon class="size-4" />
  {/snippet}
  {#snippet warningIcon()}
    <TriangleAlertIcon class="size-4" />
  {/snippet}
</Sonner>
```

#### Task 1.3: Add Toaster to root layout

**File:** `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  // ... existing imports
</script>

<!-- At end of layout, before closing -->
<Toaster
  position="bottom-right"
  duration={4000}
  closeButton={true}
  richColors={true}
  visibleToasts={3}
/>
```

#### Task 1.4: Create withToast helper utility

**File:** `src/lib/utils/toast.ts`

```typescript
import { toast } from 'svelte-sonner';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

type ToastMessages = {
  loading: string;
  success: string;
  error?: string | ((err: Error) => string);
};

/**
 * Wraps a Supabase operation with toast feedback.
 * Shows loading → success or error automatically.
 *
 * @example
 * await withToast(
 *   () => supabase.from('profiles').update({ name }).eq('id', id),
 *   { loading: m.toast_loading(), success: m.toast_settings_saved() }
 * );
 */
export async function withToast<T>(
  operation: () => Promise<PostgrestSingleResponse<T>>,
  messages: ToastMessages
): Promise<PostgrestSingleResponse<T>> {
  const toastId = toast.loading(messages.loading);

  try {
    const response = await operation();

    if (response.error) {
      const errorMessage = messages.error
        ? typeof messages.error === 'function'
          ? messages.error(new Error(response.error.message))
          : messages.error
        : response.error.message;

      toast.error(errorMessage, { id: toastId, duration: Infinity });
    } else {
      toast.success(messages.success, { id: toastId });
    }

    return response;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorMessage = messages.error
      ? typeof messages.error === 'function'
        ? messages.error(error)
        : messages.error
      : error.message;

    toast.error(errorMessage, { id: toastId, duration: Infinity });
    throw err;
  }
}

// Re-export toast for direct usage when withToast isn't suitable
export { toast } from 'svelte-sonner';
```

---

### Phase 2: i18n Message Keys

#### Task 2.1: Add EN toast message keys

**File:** `messages/en.json` (add to existing)

```json
{
  "toast_loading": "Processing...",
  "toast_success_generic": "Operation completed successfully",
  "toast_error_generic": "Something went wrong. Please try again.",
  "toast_error_network": "Network error. Check your connection.",

  "toast_settings_saved": "Settings saved",
  "toast_profile_updated": "Profile updated",

  "toast_client_created": "Client created successfully",
  "toast_client_updated": "Client updated",
  "toast_client_activated": "Client activated",
  "toast_client_deactivated": "Client deactivated",

  "toast_service_created": "Service created",
  "toast_service_updated": "Service updated",
  "toast_service_delivered": "Service marked as delivered",
  "toast_service_deleted": "Service deleted",

  "toast_request_created": "Request submitted",
  "toast_request_accepted": "Request accepted",
  "toast_request_rejected": "Request rejected",
  "toast_request_suggested": "Alternative date suggested",
  "toast_request_cancelled": "Request cancelled",
  "toast_suggestion_accepted": "Suggestion accepted",
  "toast_suggestion_declined": "Suggestion declined",

  "toast_password_changed": "Password changed successfully",
  "toast_password_reset_sent": "Password reset email sent",

  "toast_batch_success": "{count} items updated",
  "toast_batch_partial": "{success} succeeded, {failed} failed",

  "toast_pricing_saved": "Pricing configuration saved",
  "toast_scheduling_saved": "Scheduling settings saved",
  "toast_urgency_fee_deleted": "Urgency fee deleted",
  "toast_urgency_fee_in_use": "Cannot delete: urgency fee is in use"
}
```

#### Task 2.2: Add PT-PT toast message keys

**File:** `messages/pt-PT.json` (add to existing)

```json
{
  "toast_loading": "A processar...",
  "toast_success_generic": "Operação concluída com sucesso",
  "toast_error_generic": "Algo correu mal. Por favor, tente novamente.",
  "toast_error_network": "Erro de rede. Verifique a ligação.",

  "toast_settings_saved": "Definições guardadas",
  "toast_profile_updated": "Perfil atualizado",

  "toast_client_created": "Cliente criado com sucesso",
  "toast_client_updated": "Cliente atualizado",
  "toast_client_activated": "Cliente ativado",
  "toast_client_deactivated": "Cliente desativado",

  "toast_service_created": "Serviço criado",
  "toast_service_updated": "Serviço atualizado",
  "toast_service_delivered": "Serviço marcado como entregue",
  "toast_service_deleted": "Serviço eliminado",

  "toast_request_created": "Pedido enviado",
  "toast_request_accepted": "Pedido aceite",
  "toast_request_rejected": "Pedido rejeitado",
  "toast_request_suggested": "Data alternativa sugerida",
  "toast_request_cancelled": "Pedido cancelado",
  "toast_suggestion_accepted": "Sugestão aceite",
  "toast_suggestion_declined": "Sugestão recusada",

  "toast_password_changed": "Password alterada com sucesso",
  "toast_password_reset_sent": "Email de redefinição enviado",

  "toast_batch_success": "{count} itens atualizados",
  "toast_batch_partial": "{success} com sucesso, {failed} falharam",

  "toast_pricing_saved": "Configuração de preços guardada",
  "toast_scheduling_saved": "Definições de agendamento guardadas",
  "toast_urgency_fee_deleted": "Taxa de urgência eliminada",
  "toast_urgency_fee_in_use": "Não é possível eliminar: taxa de urgência em uso"
}
```

---

### Phase 3: Migration Strategy

#### Migration Pattern

For each file, apply this transformation:

**BEFORE (legacy inline banners):**
```svelte
<script lang="ts">
  let error = $state('');
  let success = $state(false);

  async function handleSubmit() {
    const { error: err } = await save();
    if (err) {
      error = err.message;
      return;
    }
    success = true;
    setTimeout(() => goto('/somewhere'), 2000);
  }
</script>

{#if error}
  <div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {error}
  </div>
{/if}
{#if success}
  <div class="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
    Saved!
  </div>
{/if}
```

**AFTER (toast notifications):**
```svelte
<script lang="ts">
  import { withToast } from '$lib/utils/toast.js';
  import * as m from '$lib/paraglide/messages.js';

  async function handleSubmit() {
    const { error } = await withToast(
      () => save(),
      { loading: m.toast_loading(), success: m.toast_settings_saved() }
    );
    if (!error) {
      goto('/somewhere');
    }
  }
</script>

<!-- No inline success/error banners needed -->
```

#### What to KEEP Inline

Field-level validation errors should remain inline:

```svelte
<!-- KEEP: Field-specific validation -->
{#if !email}
  <p class="text-sm text-destructive">Email is required</p>
{/if}

<!-- REMOVE: Form-level success/error banners -->
```

---

### Phase 4: Files to Modify

#### New Files

| File | Purpose |
|------|---------|
| `src/lib/components/ui/sonner/index.ts` | Export (created by CLI) |
| `src/lib/components/ui/sonner/sonner.svelte` | Toaster wrapper (created by CLI, needs edit) |
| `src/lib/utils/toast.ts` | `withToast()` helper utility |

#### Courier Routes (15 files)

| File | Changes |
|------|---------|
| `src/routes/courier/settings/AccountTab.svelte` | Replace inline banners with `withToast()` |
| `src/routes/courier/settings/PricingTab.svelte` | Replace inline banners with `withToast()` |
| `src/routes/courier/settings/SchedulingTab.svelte` | Replace inline banners with `withToast()` |
| `src/routes/courier/settings/ServiceTypesSection.svelte` | Add toast for service type CRUD |
| `src/routes/courier/settings/DistributionZonesSection.svelte` | Add toast for zone selection save |
| `src/routes/courier/clients/new/+page.svelte` | Replace `error`/`success` state with toast |
| `src/routes/courier/clients/[id]/+page.svelte` | Replace `actionError` with toast (archive, password reset) |
| `src/routes/courier/clients/[id]/edit/+page.svelte` | Add toast for client details edit |
| `src/routes/courier/services/new/+page.svelte` | Replace `formError` with toast |
| `src/routes/courier/services/[id]/+page.svelte` | Replace `actionError` with toast (status, delete, price override) |
| `src/routes/courier/services/+page.svelte` | Replace `batchMessage` with summary toast |
| `src/routes/courier/requests/+page.svelte` | Replace dialog feedback with toast (batch accept, individual actions) |
| `src/routes/courier/+page.svelte` | Replace dialog feedback with toast (batch reschedule) |
| `src/routes/courier/billing/[client_id]/+page.svelte` | Add toast for zone pricing operations |

#### Client Routes (5 files)

| File | Changes |
|------|---------|
| `src/routes/client/new/+page.svelte` | Replace `error` state with toast |
| `src/routes/client/+page.svelte` | Replace dialog feedback with toast (accept/reject/suggest) |
| `src/routes/client/settings/+page.svelte` | Replace inline banners with `withToast()` |
| `src/routes/client/services/[id]/edit/+page.svelte` | Replace `error` with toast |
| `src/routes/client/services/[id]/+page.svelte` | Add toast for service cancellation |

#### Shared Components (2 files)

| File | Changes |
|------|---------|
| `src/lib/components/PasswordChangeForm.svelte` | Replace success message + timeout with toast |
| `src/routes/forgot-password/+page.svelte` | Add toast for success confirmation |

#### Modified Infrastructure (3 files)

| File | Changes |
|------|---------|
| `src/routes/+layout.svelte` | Add `<Toaster />` component |
| `messages/en.json` | Add toast message keys |
| `messages/pt-PT.json` | Add toast message keys |

#### Excluded Files

| File | Reason |
|------|--------|
| `src/routes/login/+page.svelte` | Keep inline (auth is special case) |
| `src/lib/components/NotificationBell.svelte` | Keep silent (micro-interactions) |
| `src/routes/courier/calendar/+page.svelte` | Defer to later PR (low priority) |
| `src/routes/client/calendar/+page.svelte` | Defer to later PR (low priority) |

---

## Acceptance Criteria

### Functional Requirements
- [x] Toaster component renders in root layout
- [x] Toast appears for successful save operations
- [x] Toast appears for failed async operations
- [x] Success toasts auto-dismiss after 4 seconds
- [x] Error toasts persist until manually dismissed
- [x] Loading toast shows during async operations (withToast helper ready)
- [x] Toast messages are translated (EN + PT-PT)
- [x] Legacy inline banners removed from migrated files

### Non-Functional Requirements
- [ ] Toasts don't block page interaction
- [ ] Toasts stack correctly (max 3 visible)
- [ ] Toasts have proper ARIA attributes (`role="status"`, `aria-live="polite"`)
- [ ] Toasts respect `prefers-reduced-motion` (svelte-sonner handles this)
- [ ] Bundle size increase < 10 kB

### Quality Gates
- [x] `pnpm run check` passes
- [ ] `pnpm run build` succeeds
- [ ] Manual testing on mobile (iOS/Android PWA)
- [ ] Screen reader testing (VoiceOver/TalkBack basic verification)

---

## Implementation Order

1. **Foundation** (Tasks 1.1-1.4) ✅
   - [x] Install sonner
   - [x] Fix mode-watcher issue
   - [x] Add Toaster to layout
   - [x] Create withToast helper

2. **i18n** (Tasks 2.1-2.2) ✅
   - [x] Add EN message keys
   - [x] Add PT-PT message keys

3. **Courier Settings** (high usage, proves pattern) ✅
   - [x] AccountTab.svelte
   - [x] PricingTab.svelte
   - [x] SchedulingTab.svelte
   - [x] ServiceTypesSection.svelte
   - [x] DistributionZonesSection.svelte

4. **Client Management** ✅
   - [x] clients/new
   - [x] clients/[id] (archive, password reset)
   - [x] clients/[id]/edit

5. **Service Management** ✅
   - [x] services/new
   - [x] services/[id] (status, delete, price override)
   - [x] services list (batch operations with summary toast)

6. **Request Handling** ✅
   - [x] requests page (batch accept, individual actions)

7. **Billing** ✅
   - [x] billing/[client_id] (zone pricing operations)

8. **Client-Side Forms** ✅
   - [x] client/+page.svelte (dashboard - accept/reject/suggest)
   - [x] client/new
   - [x] client/settings
   - [x] client/services/[id]/edit
   - [x] client/services/[id] (reschedule actions)

9. **Shared Components** ✅
   - [x] PasswordChangeForm
   - [x] forgot-password

10. **Courier Dashboard** (deferred - batch reschedule is already handled via requests page)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User confusion on save | Reduce | No "did it save?" questions from testers |
| Error recovery | Improve | Retry actions available in error toasts |
| Bundle size | < 10 kB increase | Lighthouse audit before/after |
| Accessibility | WCAG 2.1 AA | Axe audit, manual screen reader test |

---

## References

### External
- [svelte-sonner GitHub](https://github.com/wobsoriano/svelte-sonner)
- [svelte-sonner Demo](https://svelte-sonner.vercel.app/)
- [shadcn-svelte Sonner Docs](https://shadcn-svelte.com/docs/components/sonner)
- [Toast Accessibility (Scott O'Hara)](https://www.scottohara.me/blog/2019/07/08/a-toast-to-a11y-toasts.html)
- [Toast UX Best Practices (LogRocket)](https://blog.logrocket.com/ux-design/toast-notifications/)

### Internal
- Current error pattern: `src/routes/login/+page.svelte:79-85`
- Current success pattern: `src/routes/courier/clients/new/+page.svelte:221-225`
- OfflineIndicator (keep separate): `src/lib/components/OfflineIndicator.svelte`
- i18n setup: `src/lib/paraglide/messages.js`

---

*Plan created: 2026-02-04*
*Last updated: 2026-02-04 (All phases complete. Ready for testing and final verification.)*
