---
paths:
  - "src/**/*.svelte"
  - "src/**/*.ts"
---

# Svelte 5 State Patterns

## Quick Decision: $state vs $derived

```
Does value come from prop? → $derived (auto-syncs)
Will you mutate it?        → $state (with immutable updates)
Local UI state?            → $state
```

## Core Rules

### 1. Props = $derived (NOT $state)

```svelte
<!-- CORRECT -->
let { profile } = $props();
let email = $derived(profile.email);      // Syncs with prop changes

<!-- WRONG - causes stale data bug -->
let email = $state(profile.email);        // Snapshot, doesn't sync!
```

### 2. Editable Forms = $state + $effect sync

```svelte
// svelte-ignore state_referenced_locally
let name = $state(profile.name);

$effect(() => {
  name = profile.name;  // Sync after invalidateAll()
});
```

### 3. Never Mutate $derived Arrays

```svelte
<!-- WRONG -->
let items = $derived(data.items);
items.push(newItem);  // Won't trigger reactivity!

<!-- CORRECT -->
let items = $state([...data.items]);
items = [...items, newItem];  // Reassign
```

### 4. Edit Pages: Use {#key} for Reset

```svelte
{#key data.service.id}
<ServiceEditForm {data} />
{/key}
```

## Event Handlers (Svelte 5)

```svelte
<button onclick={handleClick}>      <!-- NOT on:click -->
<form onsubmit={handleSubmit}>      <!-- NOT on:submit -->
{@render children()}                <!-- NOT <slot /> -->
```

## Code Review Red Flags

- `$state(prop.value)` without `$effect` sync
- `$derived` array with `.push()`, `.splice()`, `.pop()`
- Missing `{#key}` on edit pages with route params
- `on:click` instead of `onclick` (legacy syntax)

## Detailed Examples

For comprehensive patterns, testing strategies, and migration guides, see `docs/reference/svelte-state-guide.md`.
