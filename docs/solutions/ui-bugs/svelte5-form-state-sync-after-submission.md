# Svelte 5 Form State Loss After Submission

---
title: Svelte 5 Form State Loss After Submission with Props Binding
slug: svelte5-form-state-loss-props-binding
tags:
  - svelte
  - svelte5
  - forms
  - state-management
  - derived-state
  - reactivity
  - sveltekit
component: PricingTab.svelte
symptoms:
  - Radio button checked state lost after form submission
  - Text input values disappeared after form submission
  - Form values reverted to initial prop values instead of updated data
  - $state variables not syncing with prop changes after async operations
severity: high
date_solved: 2025-01-29
---

## Problem

After submitting a form in SvelteKit, form inputs (radio buttons, text inputs) visually lose their values. The UI reverts to showing default/initial values even though the data was saved correctly.

**Specific symptoms:**
- Pricing mode radio button loses checked state after save
- Special pricing input values disappear after save
- Form appears to reset despite successful submission

## Investigation Steps

### Step 1: Tried `bind:group` for radio buttons
Changed from `checked={...}` + `onchange` to `bind:group`. This improved binding but didn't fix the core sync issue.

### Step 2: Noticed `$state` doesn't sync with props
Discovered that `$state` initialized from props (`let value = $state(props.value)`) only captures the initial value. When props update after form submission, the `$state` variable doesn't update.

### Step 3: Researched Svelte 5.25+ behavior
Found that `$derived` values can be temporarily overridden by user interaction (since Svelte 5.25) while still auto-recalculating when source props change.

## Root Cause

In Svelte 5, `$state` initialized from props creates an independent reactive variable that **does not subscribe to prop changes**:

```svelte
// This captures the initial value ONLY
let pricingMode = $state(profile.pricing_mode ?? 'warehouse');
```

When the parent component updates `profile` after form submission:
1. The new `profile` prop flows down
2. But `pricingMode` (a `$state` variable) keeps its old value
3. UI shows stale data

## Solution

Use `$derived` instead of `$state` for form values that come from props:

```svelte
<script lang="ts">
  let { profile } = $props();

  // ✅ CORRECT: Use $derived - auto-syncs when props change
  let pricingMode = $derived((profile.pricing_mode as 'warehouse' | 'zone' | 'type') ?? 'warehouse');
  let timeSpecificPrice = $derived(profile.time_specific_price ?? 13);
  let outOfZoneBase = $derived(profile.out_of_zone_base ?? 13);

  // ❌ WRONG: $state doesn't sync when props change
  // let pricingMode = $state(profile.pricing_mode ?? 'warehouse');
</script>

<!-- Radio buttons: use bind:group -->
<input type="radio" name="pricing_mode" value="type" bind:group={pricingMode} />

<!-- Text inputs: use bind:value -->
<Input bind:value={timeSpecificPrice} />
```

### Why `$derived` Works

1. **Auto-recalculates** when source props change (after form submission)
2. **Can be temporarily overridden** by user input (Svelte 5.25+)
3. **No `{#key}` wrapper needed** - no forced remounting
4. **No `$effect` sync loops** - cleaner code

### Files Modified

- `src/routes/courier/settings/PricingTab.svelte` - Changed `$state` to `$derived` for all form values
- `src/routes/courier/settings/+page.svelte` - Removed unnecessary `{#key}` blocks
- `docs/plans/2025-01-29-type-based-pricing-implementation.md` - Documented correct pattern

## Prevention

### Decision Tree: `$state` vs `$derived`

```
Does this value come from a prop?
├─ YES → Use $derived (REQUIRED)
└─ NO
   ├─ Is it temporary UI state? (loading, errors, touched)
   │  └─ YES → Use $state
   └─ Is it derived from other state?
      └─ YES → Use $derived
      └─ NO → Use $state
```

### Code Review Checklist

- [ ] Form values from props use `$derived`, not `$state`
- [ ] Radio buttons use `bind:group`
- [ ] Inputs use `bind:value`
- [ ] No `{#key}` blocks as workaround for state sync

### Anti-Patterns to Avoid

```svelte
<!-- ❌ WRONG: $state from props -->
let X = $state(props.Y);

<!-- ❌ WRONG: Using {#key} as workaround -->
{#key formData}
  <FormComponent />
{/key}

<!-- ❌ WRONG: $effect to sync state -->
$effect(() => {
  localState = props.value;
});
```

## Testing

1. Open form with initial data
2. Change a value (radio button, text input)
3. Submit form
4. **Verify**: Value stays updated without manual refresh
5. If value reverts → using `$state` instead of `$derived`

## Related Documentation

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/$derived)
- `docs/plans/2025-01-29-type-based-pricing-implementation.md` - Task 16 documents this pattern
- `.claude/rules/code-style.md` - Svelte 5 runes section
