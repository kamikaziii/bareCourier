# Toast Notification Patterns

This document covers toast notification patterns and best practices for the bareCourier project.

---

## When to Use Each Pattern

### Decision Tree

```
Is this a form submission with use:enhance?
├─ YES → Toast in enhance callback (Pattern 1)
│
└─ NO → Continue below
         │
         Is this field-level validation?
         ├─ YES → Keep inline (no toast)
         │
         └─ NO → Continue below
                  │
                  Is this a batch operation?
                  ├─ YES → Summary toast (Pattern 3)
                  │
                  └─ NO → Direct toast call (Pattern 2)
```

---

## Pattern 1: Form Submission with `use:enhance`

Use for forms with SvelteKit form actions.

```svelte
<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { toast } from "$lib/utils/toast.js";
  import * as m from "$lib/paraglide/messages.js";
</script>

<form
  method="POST"
  action="?/updateProfile"
  use:enhance={() => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === "success") {
        await invalidateAll();
        toast.success(m.toast_profile_updated());
      } else if (result.type === "failure") {
        // NEVER expose raw server errors - always use localized messages
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    };
  }}
>
  <!-- form fields -->
</form>
```

**When to use:**
- Settings forms (AccountTab, PricingTab, SchedulingTab)
- Edit forms (client edit, service edit)
- Any form using SvelteKit form actions

---

## Pattern 2: Async Supabase Operations

Use for client-side async operations (fetch, Supabase direct calls).

```svelte
<script lang="ts">
  import { toast } from "$lib/utils/toast.js";
  import * as m from "$lib/paraglide/messages.js";

  async function handleDelete() {
    try {
      const response = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const result = await response.json();

      if (result.success) {
        toast.success(m.toast_service_deleted());
        await goto("/courier/services");
      } else {
        // NEVER expose raw server errors - always use localized messages
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    } catch {
      toast.error(m.toast_error_generic(), { duration: 8000 });
    }
  }
</script>
```

**When to use:**
- API calls via fetch
- Direct Supabase operations
- Actions triggered by buttons outside forms

---

## Pattern 3: Batch Operations

Use a **summary toast** instead of multiple individual toasts.

```svelte
<script lang="ts">
  import { toast } from "$lib/utils/toast.js";
  import * as m from "$lib/paraglide/messages.js";

  async function handleBatchUpdate(ids: string[]) {
    try {
      const response = await fetch("/api/batch-update", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      const result = await response.json();

      if (result.success) {
        // Single summary toast - NOT one per item
        toast.success(m.toast_batch_success({ count: ids.length }));
      } else {
        toast.error(m.toast_error_generic(), { duration: 8000 });
      }
    } catch {
      toast.error(m.toast_error_generic(), { duration: 8000 });
    }
  }
</script>
```

**Key rule:** Never show 5 separate toasts for 5 items. Show "5 items updated" instead.

---

## What NOT to Toast

| Scenario | Why No Toast | What to Use Instead |
|----------|--------------|---------------------|
| Field validation errors | Context needed near field | Inline `<p class="text-destructive">` |
| Login/auth errors | Keep near form | Inline banner |
| Micro-interactions | Overwhelming | No feedback or subtle UI change |
| NotificationBell actions | Silent by design | Visual state change only |

---

## Duration Guidelines

| Type | Duration | Code |
|------|----------|------|
| Success | 4000ms (default) | `toast.success(m.toast_saved())` |
| Error | 8000ms | `toast.error(msg, { duration: 8000 })` |
| Warning | 6000ms | `toast.warning(msg, { duration: 6000 })` |
| Info | 5000ms | `toast.info(msg, { duration: 5000 })` |

**Important:** Do NOT use `duration: Infinity` for errors. Users must manually dismiss even transient issues, which creates poor UX. Use 8000ms instead.

---

## Error Message Guidelines

### Always Use Localized Messages

```typescript
// CORRECT: Use i18n message
toast.error(m.toast_error_generic(), { duration: 8000 });

// WRONG: Raw string
toast.error("Something went wrong", { duration: 8000 });
```

### Never Display Raw Server Errors

Raw server errors may expose:
- Internal implementation details (table names, column names)
- Stack traces
- Sensitive information

```typescript
// CORRECT: Use localized fallback
toast.error(m.toast_error_generic(), { duration: 8000 });

// WRONG: Display raw error directly without fallback
toast.error(error.message, { duration: 8000 });
```

### Map Known Errors

For known error codes, map to specific messages:

```typescript
function mapAuthError(code: string): string {
  switch (code) {
    case "invalid_credentials":
      return m.error_invalid_credentials();
    case "email_taken":
      return m.error_email_already_exists();
    default:
      return m.toast_error_generic();
  }
}
```

---

## Codebase Examples

### Settings Form Success

```svelte
<!-- src/routes/courier/settings/AccountTab.svelte -->
use:enhance={() => {
  return async ({ result }) => {
    await applyAction(result);
    if (result.type === "success") {
      await invalidateAll();
      toast.success(m.toast_profile_updated());
    }
  };
}}
```

### Batch Operation with Count

```svelte
<!-- src/routes/courier/services/+page.svelte -->
if (result.data?.success) {
  await invalidate("app:services");
  toast.success(m.toast_batch_success({ count }));
} else {
  toast.error(m.toast_error_generic(), { duration: 8000 });
}
```

### Edge Function Error

```svelte
<!-- src/routes/courier/clients/[id]/+page.svelte -->
if (!response.ok) {
  toast.error(m.password_reset_error(), { duration: 8000 });
} else {
  toast.success(m.toast_password_changed());
}
```

### Warning After Partial Success

```svelte
<!-- src/routes/courier/clients/new/+page.svelte -->
if (pricingSaveFailed) {
  toast.success(m.toast_client_created());
  toast.warning(m.toast_client_pricing_failed(), { duration: 6000 });
} else {
  toast.success(m.toast_client_created());
}
```

---

## Code Review Checklist

When reviewing toast usage, verify:

- [ ] **Pattern match:** Does the toast pattern match the operation type (form/async/batch)?
- [ ] **Localized messages:** All messages use `m.*` functions, never raw strings
- [ ] **Duration correct:**
  - Success: no duration specified (default 4000ms)
  - Error: `{ duration: 8000 }`
  - Warning: `{ duration: 6000 }`
- [ ] **No raw server errors:** Always use fallback `|| m.toast_error_generic()`
- [ ] **Batch operations:** Single summary toast, not multiple toasts
- [ ] **Field validation:** NOT using toast (keep inline)
- [ ] **Auth/login errors:** NOT using toast (keep inline banner)
- [ ] **Error handling:** All async operations have try/catch with toast.error

### Red Flags

```typescript
// BAD: Raw error message
toast.error(error.message);

// BAD: Hardcoded string
toast.error("Failed to save");

// BAD: Infinity duration
toast.error(m.toast_error(), { duration: Infinity });

// BAD: Multiple toasts for batch
for (const item of items) {
  toast.success(`Updated ${item.name}`);
}
```

### Green Patterns

```typescript
// GOOD: Localized with fallback
toast.error(m.toast_error_generic(), { duration: 8000 });

// GOOD: Batch summary
toast.success(m.toast_batch_success({ count: items.length }));

// GOOD: Default duration for success
toast.success(m.toast_settings_saved());
```

---

## Import Pattern

Always import from the centralized utility:

```typescript
import { toast } from "$lib/utils/toast.js";
import * as m from "$lib/paraglide/messages.js";
```

---

## Library Coupling Decision

The codebase imports `{ toast }` from `$lib/utils/toast.js` in 20+ route files, creating coupling to svelte-sonner.

**Why we accept this:**
1. Re-exporting from `$lib/utils/toast.js` provides one level of indirection
2. svelte-sonner is a stable, well-maintained library
3. The app is small enough that find-replace would work for a library swap
4. Over-abstracting (creating FeedbackService) would be YAGNI

**If we ever need to swap libraries:**
1. Update `src/lib/utils/toast.ts` to wrap the new library
2. Ensure the same API (toast.success, toast.error, toast.warning)
3. Update any library-specific options

**Decision date:** 2026-02-04

---

## Related Resources

- [svelte-sonner Documentation](https://svelte-sonner.vercel.app/)
- [shadcn-svelte Sonner Docs](https://shadcn-svelte.com/docs/components/sonner)
- [Implementation Plan](../../docs/plans/2026-02-04-toast-system-implementation.md)
