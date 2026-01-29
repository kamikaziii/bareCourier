---
title: "Svelte 5 state_referenced_locally Warning - When to Use svelte-ignore vs {#key}"
slug: svelte5-state-referenced-locally-warning-fix
category: logic-errors
tags:
  - svelte5
  - runes
  - state-management
  - sveltekit
  - form-handling
  - navigation
  - component-lifecycle
  - svelte-ignore
severity: medium
components:
  - src/routes/client/services/[id]/edit/+page.svelte
  - src/routes/courier/services/[id]/edit/+page.svelte
  - src/lib/components/Sidebar.svelte
symptoms:
  - "state_referenced_locally warning in browser console"
  - "Forms showing stale data when navigating between different entities"
  - "Form pre-population not updating on route parameter changes"
  - "Svelte compiler warning about referencing props in $state() initializer"
date_solved: 2026-01-29
---

# Svelte 5 `state_referenced_locally` Warning Handling

## Problem Description

The Svelte 5 compiler emits a `state_referenced_locally` warning when you capture prop values in `$state()` initializers:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // WARNING: This reference only captures the initial value of `data`.
  // Did you mean to reference it inside a derived instead?
  let name = $state(data.client.name);
</script>
```

## Root Cause

The warning exists because:
1. `$state(initialValue)` only captures the value at initialization time
2. If the props change later, the state variable will not update
3. This can lead to stale data bugs

**Critical SvelteKit Behavior**: In SvelteKit, page components are **REUSED** when navigating between routes with the same layout structure. The `data` prop updates, but any values captured in `$state()` initializers become stale.

For example, navigating from `/services/123/edit` to `/services/456/edit` will **not** create a new component instance - the existing component receives updated `data` props.

## When This Is Actually a Bug

Consider an edit form at `/services/[id]/edit`:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();
  let name = $state(data.service.name);  // Captures "Service 123"
</script>

<input bind:value={name} />
```

1. User edits Service 123 (name field shows "Service 123")
2. User navigates to Service 456 via link (no full page reload)
3. SvelteKit reuses the component, updates `data.service` to Service 456
4. **BUG**: The form still shows "Service 123" because `name` wasn't updated

## Solutions

### Solution 1: Use `{#key}` for SvelteKit Dynamic Routes (Recommended for Edit Forms)

Force component re-creation when the entity ID changes:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally - safe because {#key data.service.id} forces re-creation
  const service = data.service;

  let pickupLocation = $state(service.pickup_location);
  let deliveryLocation = $state(service.delivery_location);
  let notes = $state(service.notes || '');
</script>

<!-- Force component re-creation when navigating between different services -->
{#key data.service.id}
<div class="space-y-6">
  <!-- form content -->
</div>
{/key}
```

**Why this works**: The `{#key}` block destroys and recreates its contents when the key value changes. When navigating from Service 123 to Service 456, the entire form is recreated with fresh state.

### Solution 2: Intentional One-Time Initialization (with Documentation)

For components where you explicitly want to capture an initial value that won't change:

```svelte
<script lang="ts">
  interface Props {
    items: NavItem[];
    currentPath: string;
    initialCollapsed?: boolean;  // Prop named "initial*" signals intent
  }

  let { items, currentPath, initialCollapsed = false }: Props = $props();

  // svelte-ignore state_referenced_locally - intentionally capturing initial value
  let collapsed = $state(initialCollapsed);
</script>
```

**Naming convention**: Prefix props with `initial` (e.g., `initialCollapsed`, `initialValue`) to signal that one-time capture is intentional.

### Solution 3: Sync State with `$effect` (for Props That Should Update)

When you need the state to stay synchronized with prop changes:

```svelte
<script lang="ts">
  let { selectedDate }: { selectedDate: string | null } = $props();

  // svelte-ignore state_referenced_locally - intentional: initial value from prop, synced via $effect
  let calendarValue = $state<DateValue | undefined>(
    selectedDate ? parseDate(selectedDate) : undefined
  );

  // Sync calendarValue when selectedDate changes externally
  $effect(() => {
    if (selectedDate) {
      calendarValue = parseDate(selectedDate);
    } else {
      calendarValue = undefined;
    }
  });
</script>
```

### Solution 4: Use `$derived` Instead of `$state`

If you don't need the value to be editable/mutable:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // No warning - derived values always reflect current prop values
  const displayName = $derived(data.profile.name);
</script>
```

## Decision Tree

```
Do you need to edit/mutate the value?
├── NO → Use $derived()
└── YES → Is this a SvelteKit page with dynamic route params (e.g., [id])?
    ├── YES → Use {#key data.entity.id} wrapper + svelte-ignore comment
    └── NO → Is one-time capture intentional?
        ├── YES → Name prop "initial*" + svelte-ignore comment
        └── NO → Use $effect() to sync state with prop changes
```

## Comment Format

Always include a brief explanation when suppressing the warning:

```svelte
// svelte-ignore state_referenced_locally - safe because {#key data.service.id} forces re-creation

// svelte-ignore state_referenced_locally - intentionally capturing initial value for one-time initialization

// svelte-ignore state_referenced_locally - intentional: initial value from prop, synced via $effect below
```

## Prevention

### Code Review Checklist

- [ ] **Navigation test performed**: Did reviewer manually test navigating between different instances of the same route?
- [ ] **Pattern justified**: Is there a code comment explaining WHY suppression is correct?
- [ ] **Key block considered**: If editing forms exist, is `{#key}` used or explicitly rejected with reason?
- [ ] **Stale data scenario checked**: What happens if user edits, navigates away, navigates to different item?

### Testing Strategy

For any page with editable state derived from route data:

1. Navigate to `/route/item-1`, make edits (don't save)
2. Navigate to `/route/item-2` using client-side navigation (link click)
3. **Expected**: Form shows item-2 data
4. **Bug indicator**: Form still shows item-1 data or your unsaved edits

### Quick Reference

| Scenario | Pattern | Action |
|----------|---------|--------|
| UI toggle (open/closed) | `let open = $state(false)` | Safe, no suppression needed |
| Form with prop initial value | `let value = $state(prop.field)` | Add `{#key prop.id}` wrapper |
| Derived display value | `let display = $state(prop.field)` | Change to `$derived(prop.field)` |
| Counter/accumulator | `let count = $state(0)` | Safe if truly local |
| Edit form on detail page | Captures route data | **Always use `{#key}`** |

## Files Changed

- `src/routes/client/services/[id]/edit/+page.svelte` - Added `{#key data.service.id}`
- `src/routes/courier/services/[id]/edit/+page.svelte` - Added `{#key data.service.id}`
- `src/lib/components/Sidebar.svelte` - `svelte-ignore` is correct (one-time init with `initialCollapsed` prop)

## References

- [SvelteKit State Management Docs](https://svelte.dev/docs/kit/state-management) - explains component reuse behavior
- [Svelte 5 $state Documentation](https://svelte.dev/docs/svelte/$state) - `$state` and `$derived` semantics
- [GitHub Issue #17303](https://github.com/sveltejs/svelte/issues/17303) - $state.snapshot() feature request
- [GitHub Issue #12877](https://github.com/sveltejs/svelte/issues/12877) - initial value warning discussion

## Related Documentation

- `.claude/rules/code-style.md` - Svelte 5 Runes (REQUIRED) section
- `.claude/rules/architecture.md` - Form Handling Pattern section
