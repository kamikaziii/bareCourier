# Svelte 5 + SvelteKit Critical Patterns

**Purpose:** Critical patterns that MUST be followed for Svelte 5 + SvelteKit projects. These patterns represent gaps between official framework documentation and real-world usage.

---

## Pattern 1: SvelteKit Server Forms - State Management

**Category:** Forms, State Management
**Severity:** High - Causes user-visible bugs (flash/flicker)
**Documentation:** [svelte5-sveltekit-form-state-pattern-20260131.md](../best-practices/svelte5-sveltekit-form-state-pattern-20260131.md)

### The Problem

Official Svelte 5 documentation recommends using `$derived` for prop-based values and warns against using `$effect` for state synchronization. However, following this guidance in SvelteKit server forms causes a **flash bug** where form values briefly disappear during save.

### Why Official Pattern Fails

```svelte
<!-- ❌ WRONG: Official Svelte pattern (causes flash in SvelteKit) -->
<script lang="ts">
  let { profile } = $props();

  // Svelte docs recommend this
  let pricingMode = $derived(profile.pricing_mode ?? 'warehouse');
</script>

<form method="POST" action="?/save" use:enhance>
  <input type="radio" bind:group={pricingMode} />
</form>
```

**What happens:**
1. User changes value → `bind:group` overrides `$derived` ✅
2. Form submits → Page re-renders with STALE props
3. `$derived` recalculates from OLD data → **FLASH!** ❌
4. New data arrives → `$derived` updates → Values reappear

### Correct Pattern for SvelteKit

```svelte
<!-- ✅ CORRECT: SvelteKit server form pattern -->
<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { profile } = $props();

  // Initialize with defaults (NOT from props)
  let pricingMode = $state<'warehouse' | 'zone'>('warehouse');

  // Sync with props (despite docs warning against this)
  $effect(() => {
    pricingMode = profile.pricing_mode ?? 'warehouse';
  });
</script>

<form
  method="POST"
  action="?/save"
  use:enhance={async () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll(); // ← CRITICAL!
      }
    };
  }}
>
  <input type="radio" bind:group={pricingMode} />
  <button type="submit">Save</button>
</form>
```

### Why This Works

**Timeline with correct pattern:**
1. User edits → `$state` updates ✅
2. Form submits → `$state` keeps value (doesn't recalculate) ✅
3. `invalidateAll()` fetches fresh data ✅
4. Props update → `$effect` syncs state ✅
5. **No flash** - smooth transition

### Critical Rules

1. **For SvelteKit server forms with `bind:value` or `bind:group`:**
   - ✅ Use `$state` + `$effect` + `invalidateAll()`
   - ❌ DON'T use `$derived` (causes flash bug)

2. **For component-to-component communication:**
   - ✅ Use `$derived` (follows official docs)
   - ✅ Use `$bindable` for two-way binding

3. **Always include `invalidateAll()` in form callbacks:**
   ```svelte
   use:enhance={async () => {
     return async ({ result }) => {
       await applyAction(result);
       if (result.type === 'success') {
         await invalidateAll(); // Don't forget this!
       }
     };
   }}
   ```

### Decision Tree

```
Is this a SvelteKit form with server actions?
├─ YES → Use $state + $effect + invalidateAll()
│        (Despite Svelte docs calling this an "anti-pattern")
└─ NO (component-to-component)
   ├─ Two-way binding? → Use $bindable
   ├─ Derived value? → Use $derived
   └─ Local UI state? → Use $state
```

### Code Review Checklist

When reviewing SvelteKit forms:

- [ ] Form inputs use `$state`, not `$derived`
- [ ] There's an `$effect` syncing form state with props
- [ ] Form has `use:enhance` with callback
- [ ] Callback includes `await invalidateAll()` on success
- [ ] State initialized with defaults: `$state(defaultValue)`
- [ ] NOT initialized from props: ~~`$state(prop.value)`~~

### Why This Matters

This is a **framework documentation gap**. Svelte 5 docs are optimized for client-side component apps, not SvelteKit server forms. The patterns differ:

| Context | Pattern |
|---------|---------|
| Svelte components | `$derived` for props |
| SvelteKit server forms | `$state` + `$effect` |
| Optimistic UI (client) | `$derived` with override |
| Server round-trip | `$state` + `invalidateAll()` |

### Related Documentation

- [Complete explanation](../best-practices/svelte5-sveltekit-form-state-pattern-20260131.md)
- [Flash bug discovery](../ui-bugs/svelte5-form-flash-bind-derived-20260131.md)
- [Official Svelte $effect docs](https://svelte.dev/docs/svelte/$effect) (warns against this pattern)
- [Official Svelte $derived docs](https://svelte.dev/docs/svelte/$derived) (recommended pattern that fails in SvelteKit)

---

## Future Patterns

Additional critical patterns will be added here as they're discovered.
