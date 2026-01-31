---
module: Settings Components
date: 2026-01-31
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Form input values briefly disappear (flash) after clicking save button"
  - "Radio button selection temporarily vanishes then reappears after form submission"
  - "Number input values clear momentarily then repopulate after page reload"
  - "Visual flash/flicker when form values reset to old values during save cycle"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [svelte-5, runes, reactivity, forms, bind-value, derived, state, effect, flash-bug, ux]
---

# Troubleshooting: Svelte 5 Form Flash Bug with bind:value and $derived

## Problem

When using `bind:value` or `bind:group` with `$derived` values in Svelte 5 forms, input values briefly **disappear (flash)** during the form submission cycle, then reappear a moment later. This creates a jarring UX where users see their selections/inputs vanish and wonder if the save worked.

## Environment

- Module: Settings (AccountTab, PricingTab, SchedulingTab components)
- Framework: SvelteKit 2.50+
- Svelte Version: 5.47+ (runes syntax)
- Affected Component: All settings tab components with form inputs
- Date: 2026-01-31

## Symptoms

- **Pricing mode radio buttons**: Selection disappears briefly after save, then reappears
- **Special pricing inputs**: All three numeric fields clear momentarily, then values repopulate
- **Warehouse address**: Input value flashes blank during save cycle
- **Label branding fields**: Text values temporarily disappear after form submission
- No errors in console - purely visual UX issue

## What Didn't Work

**Attempted Solution 1:** Using `$derived` for all form values (based on previous documentation)
- **Why it failed:** This is actually what CAUSED the flash bug. `bind:value` with `$derived` creates temporary override during user input, but when component re-renders during form submission with stale props, `$derived` resets to OLD prop value (flash!), then updates to NEW value when data arrives.

**Attempted Solution 2:** Using `{#key}` blocks to force component re-mount
- **Why it failed:** Wasteful approach that destroys and recreates entire component instead of just syncing values. Also adds unnecessary complexity.

**Attempted Solution 3:** Original `$state` without `$effect` sync
- **Why it failed:** Values initialized from props but never updated when props changed after form submission. Form showed stale data after successful save.

## Solution

Use the **Dashboard Pattern**: `$state` + `$effect` + `invalidateAll()`

This pattern provides:
1. **Mutable state** for user input (required for `bind:value`)
2. **Automatic sync** when props update after form submission
3. **No flash** - smooth transition from user edit → save → updated display

**Code changes:**

```svelte
<!-- BEFORE (caused flash bug): -->
<script lang="ts">
  let { profile } = $props();

  // ❌ Using $derived with bind:value causes flash
  let pricingMode = $derived(profile.pricing_mode ?? 'warehouse');
  let minimumCharge = $derived(profile.minimum_charge ?? 0);
</script>

<input type="radio" bind:group={pricingMode} />
<Input bind:value={minimumCharge} />

<!-- AFTER (fixed - no flash): -->
<script lang="ts">
  import { applyAction } from '$app/forms';
  import { invalidateAll } from '$app/navigation';

  let { profile } = $props();

  // ✅ Initialize with default values (not from props)
  let pricingMode = $state<'warehouse' | 'zone' | 'type'>('warehouse');
  let minimumCharge = $state(0);

  // ✅ Sync with props when they update (after form submission)
  $effect(() => {
    pricingMode = profile.pricing_mode ?? 'warehouse';
    minimumCharge = profile.minimum_charge ?? 0;
  });
</script>

<!-- ✅ Form with proper invalidation -->
<form
  method="POST"
  action="?/updatePricingMode"
  use:enhance={async () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll(); // ← Key! Triggers prop update
      }
    };
  }}
>
  <input type="radio" bind:group={pricingMode} />
  <Input bind:value={minimumCharge} />
  <button type="submit">Save</button>
</form>
```

## Why This Works

### The Flash Bug Lifecycle (with `$derived`)

1. **User changes value** → `bind:value` temporarily overrides `$derived` ✅
2. **User clicks save** → Form submits
3. **Component re-renders** with stale props → `$derived` resets to OLD prop value ❌ **FLASH!**
4. **New data arrives from server** → `$derived` updates to NEW value
5. Values reappear (user confused)

### The Fixed Lifecycle (with `$state` + `$effect`)

1. **User changes value** → `bind:value` updates `$state` ✅
2. **User clicks save** → Form submits
3. **`invalidateAll()` runs** → Refreshes all page data, including `profile` prop ✅
4. **`$effect` triggers** → Syncs local `$state` with new prop value ✅
5. **No flash** - smooth transition from user input to saved value

### Key Insight

The root cause is the **timing mismatch**:
- `$derived` recalculates **immediately** when props change
- But props are **stale** during the re-render between submission and data arrival
- This causes `$derived` to show old value (flash) before new data arrives

`$state` + `$effect` works because:
- Local state holds user's value during the submission cycle
- `$effect` only syncs when props ACTUALLY update (after `invalidateAll()`)
- No premature reset to stale props

## Prevention

### Decision Tree: `$state` vs `$derived` for Form Inputs

```
Does this form input use bind:value or bind:group?
├─ YES
│  └─ Does the value come from a prop that updates after form submission?
│     ├─ YES → Use $state + $effect + invalidateAll() ✅
│     └─ NO → Use $state (local form state only)
└─ NO (read-only display)
   └─ Use $derived
```

### Critical Rules

1. **NEVER use `bind:value` with `$derived`** in Svelte 5 - causes flash bug
2. **ALWAYS include `invalidateAll()`** in form's `use:enhance` callback after successful submission
3. **ALWAYS sync form state** with `$effect` when values come from props
4. **Initialize `$state` with defaults**, not prop values (prevents stale initial state)

### Code Review Checklist

When reviewing Svelte 5 forms, check:
- [ ] Form inputs with `bind:value` use `$state`, not `$derived`
- [ ] There's an `$effect` syncing local state with prop updates
- [ ] Form's `use:enhance` calls `invalidateAll()` on success
- [ ] State is initialized with defaults, not `$state(prop.value)`
- [ ] No flash observed when saving form (manual test)

### Testing Strategy

**Manual Testing:**
1. Open form with initial data (e.g., Settings → Pricing tab)
2. Change a value (radio button, number input, text field)
3. Click Save
4. **Watch carefully** - do values flash/disappear momentarily?
5. **Expected**: Smooth transition, no flash
6. **If flash occurs**: Using `$derived` with `bind:value` (anti-pattern)

**E2E Testing:**
```typescript
// Playwright test
test('form values do not flash during save', async ({ page }) => {
  await page.goto('/settings');

  // Set value
  await page.getByRole('radio', { name: 'Zone-based' }).click();

  // Save and watch for flash
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify radio stays checked throughout (no flash)
  await expect(page.getByRole('radio', { name: 'Zone-based' }))
    .toBeChecked();

  // Wait for save to complete
  await page.waitForLoadState('networkidle');

  // Value should still be checked
  await expect(page.getByRole('radio', { name: 'Zone-based' }))
    .toBeChecked();
});
```

## Related Issues

- **⭐ BEST PRACTICE DOCUMENTATION**: See [svelte5-sveltekit-form-state-pattern-20260131.md](../best-practices/svelte5-sveltekit-form-state-pattern-20260131.md) - Comprehensive explanation of why the official Svelte pattern fails in SvelteKit and why this "anti-pattern" is actually correct for server forms.
- **OPPOSITE PATTERN**: See [svelte5-form-state-sync-after-submission.md](./svelte5-form-state-sync-after-submission.md) - That doc recommends using `$derived` for form values, which causes THIS flash bug.
- **Related guidance**: See `.claude/rules/svelte-form-state.md` - Documents the `$state` + `$effect` pattern for form inputs
- **Mutation patterns**: See `.claude/rules/svelte-reactive-mutation-prevention.md` - Array/object mutation with `$derived` vs `$state`

## Files Modified

- `src/routes/courier/settings/PricingTab.svelte` - Changed all form inputs from `$derived` to `$state` + `$effect`
- `src/routes/courier/settings/AccountTab.svelte` - Added `$effect` sync and `invalidateAll()` to forms
- `src/routes/courier/settings/SchedulingTab.svelte` - Already using correct pattern (no changes)
- `src/lib/components/NotificationsTab.svelte` - Already using correct pattern (no changes)

## Key Takeaway

**Svelte 5 Rune Selection for Forms:**
- **Display prop values** (read-only) → `$derived`
- **Edit prop values** (bind:value) → `$state` + `$effect` + `invalidateAll()`
- **Local UI state** (loading, errors) → `$state`

This is a **critical distinction** not obvious from Svelte 5 documentation, and getting it wrong causes subtle UX bugs (flash) that confuse users.
