---
module: Framework Best Practices
date: 2026-01-31
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Form input values flash/disappear during save cycle when using Svelte 5 $derived"
  - "Official Svelte docs recommend $derived but it causes flash bug in SvelteKit"
  - "Official docs warn against $effect for state sync but it's required for SvelteKit forms"
  - "Gap between Svelte component patterns and SvelteKit server form patterns"
root_cause: documentation_gap
resolution_type: documentation_update
severity: high
tags: [svelte-5, sveltekit, forms, runes, state-management, best-practices, framework-gap, $derived, $state, $effect, invalidateAll]
---

# Best Practice: Svelte 5 Form State in SvelteKit Server Forms

## Problem

There's a critical gap between Svelte 5's official documentation and what actually works in SvelteKit server-side forms. Following the official Svelte guidance causes a **flash bug** where form values briefly disappear during save, while the pattern that works is explicitly labeled an "anti-pattern" in Svelte docs.

**The Dilemma:**
- ✅ **Svelte docs say**: Use `$derived` for props, avoid `$effect` for state sync
- ❌ **Reality**: `$derived` causes flash bug in SvelteKit forms
- ✅ **What works**: `$state` + `$effect` + `invalidateAll()` (labeled "anti-pattern")

## Environment

- Framework: SvelteKit 2.50+
- Svelte Version: 5.47+ (runes syntax)
- Pattern Type: Server-side form actions (not client-only forms)
- Components: Settings tabs (AccountTab, PricingTab, SchedulingTab)
- Date: 2026-01-31

## Symptoms

### With Official Pattern ($derived)
- Form input values **flash/disappear** during save cycle
- Radio buttons lose selection momentarily then reappear
- Number inputs clear briefly after submission
- Users confused whether save worked

### Missing Pattern Component
- Forms using `use:enhance` without `invalidateAll()` callback
- Props never update after form submission
- `$effect` never triggers to sync state
- Flash occurs because local state diverges from stale props

## Investigation Journey

### Step 1: Followed Official Svelte 5 Docs

According to [official Svelte documentation](https://svelte.dev/docs/svelte/$effect):

> "`$effect` is best considered something of an escape hatch — useful for things like analytics and direct DOM manipulation — rather than a tool you should use frequently. **In particular, avoid using it to synchronise state.**"

**Recommended pattern from docs:**
```svelte
// Official: Use $derived for prop-based values
let value = $derived(props.value);

// Since Svelte 5.25+, $derived can be temporarily overridden
<input bind:value={value} />
```

### Step 2: Discovered Flash Bug

When implemented in SvelteKit form:

```svelte
<script lang="ts">
  let { profile } = $props();

  // Following official docs
  let pricingMode = $derived(profile.pricing_mode ?? 'warehouse');
</script>

<form method="POST" action="?/save" use:enhance>
  <input type="radio" bind:group={pricingMode} />
  <button type="submit">Save</button>
</form>
```

**Result:** Flash bug occurs!

**Why it fails:**
1. User changes value → `bind:group` temporarily overrides `$derived` ✅
2. User clicks Save → form submits
3. **Component re-renders with STALE props** → `$derived` recalculates from OLD data ❌ **FLASH!**
4. Server responds → New props arrive → `$derived` recalculates correctly
5. Values reappear (user confused)

### Step 3: Research Official Guidance

From [Svelte $derived docs](https://svelte.dev/docs/svelte/$derived):

> "Derived expressions are recalculated when their dependencies change, but you can temporarily override their values by reassigning them."

This works for **optimistic UI** in client-side apps, but SvelteKit server forms have a different timing:
- **Optimistic UI**: Immediate override → async server call → rollback if needed
- **SvelteKit forms**: Override → page navigation/reload → stale props → flash

### Step 4: Tried "Anti-Pattern" Solution

Used `$state` + `$effect` (explicitly warned against in docs):

```svelte
<script lang="ts">
  import { applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { profile } = $props();

  // "Anti-pattern" according to docs
  let pricingMode = $state('warehouse');

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
</form>
```

**Result:** ✅ No flash! Works perfectly!

## Solution

### The Working Pattern for SvelteKit Server Forms

```svelte
<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { profile } = $props();

  // 1. Initialize with defaults (NOT from props)
  let formField = $state(defaultValue);

  // 2. Sync with props using $effect (runs after invalidateAll)
  $effect(() => {
    formField = profile.formField;
  });
</script>

<!-- 3. Form with invalidateAll callback -->
<form
  method="POST"
  action="?/updateField"
  use:enhance={async () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll(); // Triggers prop update → $effect runs
      }
    };
  }}
>
  <input bind:value={formField} />
  <button type="submit">Save</button>
</form>
```

### Why This Works

**The Timing:**
1. User edits input → `bind:value` updates `$state` ✅
2. User clicks Save → form submits
3. **`invalidateAll()` runs** → Fetches fresh data from server ✅
4. **Props update with NEW data** → `$effect` triggers ✅
5. **`$effect` syncs local state** with new prop value ✅
6. **No flash** - smooth transition from user input to saved value

**Key insight:** The `$effect` doesn't run during re-render (when props are stale), it only runs **after** `invalidateAll()` fetches fresh props. This prevents the flash.

### Complete Example

```svelte
<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';

  interface Props {
    profile: Profile;
  }

  let { profile }: Props = $props();

  // Initialize form state with defaults
  let pricingMode = $state<'warehouse' | 'zone' | 'type'>('warehouse');
  let minimumCharge = $state(0);
  let vatRate = $state(23);

  // Sync with props after successful form submission
  $effect(() => {
    pricingMode = profile.pricing_mode ?? 'warehouse';
    minimumCharge = profile.minimum_charge ?? 0;
    vatRate = profile.vat_rate ?? 23;
  });
</script>

<form
  method="POST"
  action="?/updatePricing"
  use:enhance={async () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
      }
    };
  }}
  class="space-y-4"
>
  <!-- Radio buttons -->
  <div>
    <label>
      <input type="radio" name="mode" value="warehouse" bind:group={pricingMode} />
      Warehouse-based
    </label>
    <label>
      <input type="radio" name="mode" value="zone" bind:group={pricingMode} />
      Zone-based
    </label>
  </div>

  <!-- Number inputs -->
  <Input
    label="Minimum Charge"
    type="number"
    name="minimum_charge"
    bind:value={minimumCharge}
  />

  <Input
    label="VAT Rate (%)"
    type="number"
    name="vat_rate"
    bind:value={vatRate}
  />

  <Button type="submit">Save</Button>
</form>
```

## Why This Works (Technical Explanation)

### The Gap: Component Patterns vs Server Form Patterns

**Svelte docs focus on component-to-component communication:**
- Parent → Child: Props flow down
- Child → Parent: Use `$bindable` rune for two-way binding
- Optimistic UI: Override `$derived`, async update, rollback if needed

**SvelteKit server forms are different:**
- User → Server: Form submission
- Server → User: Page data reload
- **Timing gap**: Props are stale during re-render, fresh after `invalidateAll()`

### Why Official Pattern Fails

```svelte
// Official pattern
let value = $derived(props.value);
<input bind:value={value} />
```

**Timeline:**
1. `bind:value` overrides `$derived` (works)
2. Form submits → Page re-renders
3. **Props are STALE** → `$derived` recalculates from old data → FLASH!
4. `invalidateAll()` happens (if you remember to call it)
5. Props update → `$derived` recalculates → Values reappear

### Why "Anti-Pattern" Works

```svelte
// "Anti-pattern" (but works!)
let value = $state(defaultValue);
$effect(() => { value = props.value; });
<input bind:value={value} />
```

**Timeline:**
1. `bind:value` updates `$state` (works)
2. Form submits → Page re-renders
3. **Props are STALE but `$effect` doesn't run yet** → No flash!
4. `invalidateAll()` fetches fresh data
5. Props update → `$effect` triggers → Syncs to new value

**Key difference:** `$effect` only runs when props **actually change** (after `invalidateAll()`), not during re-render with stale props.

## Prevention

### Decision Tree: When to Use Each Pattern

```
Are you building a SvelteKit form with server actions?
├─ YES
│  └─ Use $state + $effect + invalidateAll()
│     (Despite Svelte docs warning against it)
│
└─ NO (Component-to-component communication)
   ├─ Two-way binding needed?
   │  └─ YES → Use $bindable rune
   │  └─ NO → Use $derived
   │
   └─ Optimistic UI pattern?
      └─ YES → Use $derived with override
      └─ NO → Use $derived
```

### Code Review Checklist

When reviewing SvelteKit forms with Svelte 5:

- [ ] Forms use `$state` for bound inputs (not `$derived`)
- [ ] There's an `$effect` syncing form state with props
- [ ] All forms have `use:enhance` with callback
- [ ] Callbacks include `await invalidateAll()` after success
- [ ] State is initialized with defaults, not `$state(prop.value)`
- [ ] No flash observed during save (manual test required)

### Common Mistakes

```svelte
<!-- ❌ MISTAKE 1: Using $derived for form inputs -->
<script>
  let value = $derived(profile.value);
</script>
<input bind:value={value} /> <!-- Flash bug! -->

<!-- ❌ MISTAKE 2: Missing invalidateAll() -->
<form method="POST" use:enhance>
  <!-- Props never update, $effect never runs -->
</form>

<!-- ❌ MISTAKE 3: Initializing $state from props -->
<script>
  let value = $state(profile.value); // Captures initial value only
  // Missing $effect to sync with prop updates
</script>

<!-- ✅ CORRECT: Full pattern -->
<script>
  let value = $state(defaultValue);
  $effect(() => { value = profile.value; });
</script>
<form use:enhance={async () => {
  return async ({ result }) => {
    await applyAction(result);
    if (result.type === 'success') {
      await invalidateAll();
    }
  };
}}>
  <input bind:value={value} />
</form>
```

## Testing

### Manual Testing

1. Open form with initial data
2. Change a value (radio, input, select)
3. Click Save
4. **Watch carefully** - do values flash/disappear?
5. **Expected**: Smooth transition, no visual glitch
6. **If flash occurs**: Check if using `$derived` or missing `invalidateAll()`

### E2E Testing

```typescript
// tests/form-flash.spec.ts
import { test, expect } from '@playwright/test';

test('form values do not flash during save', async ({ page }) => {
  await page.goto('/settings');

  // Set value
  const radio = page.getByRole('radio', { name: 'Zone-based' });
  await radio.click();
  await expect(radio).toBeChecked();

  // Save
  await page.getByRole('button', { name: 'Save' }).click();

  // Radio should stay checked throughout (no flash)
  await expect(radio).toBeChecked();

  // Wait for save to complete
  await page.waitForLoadState('networkidle');

  // Still checked after reload
  await expect(radio).toBeChecked();
});
```

## Related Documentation

### Framework Documentation

- [Svelte $effect Documentation](https://svelte.dev/docs/svelte/$effect) - Warning against using `$effect` for state sync
- [Svelte $derived Documentation](https://svelte.dev/docs/svelte/$derived) - Official pattern that causes flash in SvelteKit
- [SvelteKit Form Actions](https://svelte.dev/docs/kit/form-actions) - Server-side form handling
- [SvelteKit use:enhance](https://svelte.dev/tutorial/kit/customizing-use-enhance) - Progressive enhancement

### Project Documentation

- **⭐ REQUIRED READING**: [Svelte + SvelteKit Critical Patterns](../patterns/svelte-sveltekit-critical-patterns.md#pattern-1-sveltekit-server-forms---state-management) - This pattern is documented as Pattern #1 in critical patterns.
- [svelte5-form-flash-bind-derived-20260131.md](../ui-bugs/svelte5-form-flash-bind-derived-20260131.md) - The flash bug we discovered
- [svelte5-form-state-sync-after-submission.md](../ui-bugs/svelte5-form-state-sync-after-submission.md) - Earlier doc recommending `$derived` (now superseded)
- `.claude/rules/svelte-form-state.md` - Project rules documenting this pattern
- `.claude/rules/svelte-reactive-mutation-prevention.md` - Array/object mutation patterns

### External Resources

- [Progressive Form Enhancement With SvelteKit](https://joyofcode.xyz/sveltekit-progressive-enhancement)
- [Understanding Svelte 5 Runes: $derived vs $effect](https://dev.to/mikehtmlallthethings/understanding-svelte-5-runes-derived-vs-effect-1hh)
- [Two-Way Binding with $bindable in Svelte](https://codesignal.com/learn/courses/component-communication-events-in-svelte/lessons/two-way-binding-with-bind-and-bindable-in-svelte)

## Files Modified

This pattern was applied to:
- `src/routes/courier/settings/PricingTab.svelte`
- `src/routes/courier/settings/AccountTab.svelte`
- `src/routes/courier/settings/SchedulingTab.svelte`
- `src/lib/components/NotificationsTab.svelte`

## Key Takeaway

**There's a framework documentation gap:**

| Pattern | Svelte Docs Say | SvelteKit Reality |
|---------|-----------------|-------------------|
| `$derived` for props | ✅ Recommended | ❌ Causes flash bug in server forms |
| `$effect` for state sync | ❌ Anti-pattern | ✅ Required for server forms |
| `$bindable` for two-way | ✅ Recommended | ⚠️ Only for component-to-component |

**The lesson:** Official Svelte documentation is optimized for **component-based** apps (single-page, client-side). SvelteKit **server forms** have different timing constraints (page navigation, server round-trips) that require different patterns.

**When to trust the docs:**
- Building reusable components
- Client-side forms (no server action)
- Component-to-component communication

**When to use the "anti-pattern":**
- SvelteKit forms with server actions
- Any pattern involving `use:enhance` + `invalidateAll()`
- Forms where data comes from server load functions

This is a **critical best practice** for SvelteKit + Svelte 5 projects.
