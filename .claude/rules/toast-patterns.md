---
paths:
  - "src/**/*.svelte"
---

# Toast Notification Patterns

## Decision Tree

```
Form with use:enhance? → Toast in enhance callback
Field validation?      → Keep inline (no toast)
Batch operation?       → Single summary toast
Otherwise?             → Direct toast call
```

## Core Patterns

### 1. Form with `use:enhance`
```svelte
use:enhance={() => {
  return async ({ result }) => {
    await applyAction(result);
    if (result.type === "success") {
      await invalidateAll();
      toast.success(m.toast_profile_updated());
    } else if (result.type === "failure") {
      toast.error(m.toast_error_generic(), { duration: 8000 });
    }
  };
}}
```

### 2. Async Operations
```typescript
if (result.success) {
  toast.success(m.toast_service_deleted());
} else {
  toast.error(m.toast_error_generic(), { duration: 8000 });
}
```

### 3. Batch Operations
```typescript
// Single summary - NOT one per item
toast.success(m.toast_batch_success({ count: items.length }));
```

## Duration Guidelines

| Type | Duration |
|------|----------|
| Success | 4000ms (default) |
| Error | `{ duration: 8000 }` |
| Warning | `{ duration: 6000 }` |

## Rules

1. **Always use localized messages** - `m.*` functions, never raw strings
2. **Never expose raw server errors** - Always use `m.toast_error_generic()` fallback
3. **No toast for field validation** - Use inline `<p class="text-destructive">`
4. **No toast for auth errors** - Use inline banner
5. **No `duration: Infinity`** - Use 8000ms for errors

## Import

```typescript
import { toast } from "$lib/utils/toast.js";
import * as m from "$lib/paraglide/messages.js";
```
