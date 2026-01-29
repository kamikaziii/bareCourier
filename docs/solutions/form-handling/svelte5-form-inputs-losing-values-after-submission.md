---
title: "Svelte 5 Form Inputs Losing Values After Form Submission"
slug: svelte5-form-inputs-losing-values-after-submission
category: form-handling
tags:
  - svelte5
  - runes
  - state-management
  - forms
  - $derived
  - $state
  - bind:value
  - bind:group
severity: high
components:
  - src/routes/courier/settings/PricingSettings.svelte
symptoms:
  - "Form fields reset to initial values after form submission returns new data"
  - "User input disappears despite successful API request"
  - "Radio button selections revert to prop value"
  - "Text inputs show stale values after form submission"
date_solved: 2026-01-29
---

# Svelte 5 Form Inputs Losing Values After Form Submission

## Problem Description

After submitting a form that updates component props (e.g., in the same SvelteKit page component), form input fields reset to their initial prop values instead of showing the new submitted data. This happens even though:

1. The form submission succeeds
2. The server returns the updated data
3. The parent component updates the props
4. The form inputs visibly reset

Example scenario:
```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Form captures initial prop value
  let pricingMode = $state(data.profile.pricing_mode ?? 'warehouse');

  async function handleSubmit(e: Event) {
    e.preventDefault();

    // Update server
    const response = await fetch('/api/update', {
      method: 'POST',
      body: JSON.stringify({ pricingMode })
    });

    const result = await response.json();

    // Server returns updated profile data
    // Parent component updates `data` prop with new value
    // BUT: pricingMode state still holds old value!
    // Form shows: "warehouse" (old value)
    // Expected: "type" (new value)
  }
</script>

<input type="radio" name="pricing_mode" value="warehouse" bind:group={pricingMode} />
<input type="radio" name="pricing_mode" value="type" bind:group={pricingMode} />
<button onclick={handleSubmit}>Save</button>
```

## Investigation Steps

### Step 1: Initial Hypothesis - Binding Issue
Attempted using `bind:group` instead of `checked` + `onchange` for radio buttons. This helped with user interaction but didn't solve the core issue of values resetting after submission.

### Step 2: Noticed State Capture Problem
Discovered that `$state` initialized from props captures only the initial value at component creation time:

```typescript
// This only captures the value ONCE during initialization
let pricingMode = $state(data.profile.pricing_mode ?? 'warehouse');

// When data.profile.pricing_mode changes later, pricingMode doesn't update
```

### Step 3: Researched Svelte 5.25+ Behavior
Found that Svelte 5.25+ allows `$derived` values to be temporarily overridden by user interaction while still auto-syncing to prop changes.

## Root Cause

In Svelte 5, reactive state initialization from props follows this pattern:

1. `let value = $state(props.value)` captures the prop value **at initialization only**
2. The `$state` variable becomes independent and does not subscribe to prop changes
3. When the parent component updates the prop (e.g., after form submission), the `$state` variable retains its old value
4. User input in the form field binds to the stale `$state` value, not the updated prop

This is particularly problematic for:
- Form submissions that update parent data
- Same-page form updates without page reload
- Components receiving updated data from parent

## Solution

Use `$derived` for form values instead of `$state`, combined with `bind:value` or `bind:group`:

### Solution Pattern: Use `$derived` with Bindings

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // BEFORE (broken) - captures initial value only
  let pricingMode = $state(data.profile.pricing_mode ?? 'warehouse');

  // AFTER (working) - auto-syncs to prop changes
  let pricingMode = $derived(
    (data.profile.pricing_mode as 'warehouse' | 'zone' | 'type') ?? 'warehouse'
  );

  // Same for text inputs
  let timeSpecificPrice = $derived(
    data.profile.time_specific_price?.toString() ?? ''
  );
</script>

<!-- Radio buttons: use bind:group -->
<div class="space-y-2">
  <label class="flex items-center gap-2">
    <input type="radio" name="pricing_mode" value="warehouse" bind:group={pricingMode} />
    Warehouse
  </label>
  <label class="flex items-center gap-2">
    <input type="radio" name="pricing_mode" value="type" bind:group={pricingMode} />
    Type-based
  </label>
  <label class="flex items-center gap-2">
    <input type="radio" name="pricing_mode" value="zone" bind:group={pricingMode} />
    Zone-based
  </label>
</div>

<!-- Text inputs: use bind:value -->
<Input bind:value={timeSpecificPrice} type="number" />

<button onclick={handleSubmit}>Save</button>
```

### How It Works

1. **`$derived` auto-recalculates**: When `data.profile.pricing_mode` changes, the derived value automatically updates
2. **Bindings still work**: `bind:group` and `bind:value` can temporarily override the derived value when user interacts
3. **Props sync takes priority**: When props change (after form submission), the derived value resyncs to the new prop value
4. **User input preserved during interaction**: While user is editing, bindings keep the local value in sync without losing edits

### Before/After Comparison

| Scenario | Before (`$state`) | After (`$derived`) |
|----------|------------------|-------------------|
| User edits form | ✓ Works | ✓ Works |
| User submits form | ✓ Succeeds | ✓ Succeeds |
| Server returns updated data | ✗ Form resets to old value | ✓ Form shows new value |
| User types new value after reset | ✗ Stale value reappears | ✓ Form bindings work correctly |

## Type Safety Consideration

When casting prop values to derived, be explicit about valid types:

```svelte
<!-- GOOD: explicit type assertion for radio button values -->
let pricingMode = $derived(
  (data.profile.pricing_mode as 'warehouse' | 'zone' | 'type') ?? 'warehouse'
);

<!-- ALSO OK: let TypeScript infer from database type -->
let pricingMode = $derived(data.profile.pricing_mode ?? 'warehouse');
```

## When NOT to Use This Pattern

This pattern is for form inputs that should reflect updated prop values. Do NOT use `$derived` for:

- **UI state that's truly local**: Toggle switches, modals, filters not backed by props
- **Accumulating values**: Counters, search results that build up during session
- **One-time initialization**: Use `$state` with `svelte-ignore state_referenced_locally` if you explicitly want to capture initial value only

For these, use `$state` as designed:

```svelte
let isOpen = $state(false);           // Local UI state
let filterQuery = $state('');          // Local search/filter
let formErrors = $state<Record<string, string>>({});  // Local validation state
```

## Decision Tree

```
Does this form value come from a prop?
├── NO → Use $state(initialValue)
└── YES → Will the prop change after form submission?
    ├── NO → Use $state() is fine, or $derived() for auto-sync
    └── YES → Use $derived(prop.value) with bind:value/bind:group
```

## Testing Checklist

For any form that updates parent data in the same component:

1. Load page with initial data (e.g., `pricingMode = "warehouse"`)
2. Change form value (e.g., select "type-based")
3. Submit form
4. **Expected**: Form shows updated value from server response
5. **Bug indicator**: Form reverts to old value after submission

Test code:
```typescript
// In a test file or browser console
const initialValue = getFormValue('pricing_mode');
clickRadioButton('type');
submitForm();
await waitForServerResponse();
const finalValue = getFormValue('pricing_mode');
// finalValue should match server response, not initialValue
```

## Files Changed

- `src/routes/courier/settings/PricingSettings.svelte` - Changed `pricingMode` and `timeSpecificPrice` from `$state` to `$derived`

## Related Documentation

- `.claude/rules/code-style.md` - Svelte 5 Runes section
- `.claude/rules/architecture.md` - Form Handling Pattern section

## References

- [Svelte 5 $derived Documentation](https://svelte.dev/docs/svelte/$derived)
- [Svelte 5 $state Documentation](https://svelte.dev/docs/svelte/$state)
- [SvelteKit State Management](https://svelte.dev/docs/kit/state-management)
- [Svelte 5 Bindings (bind:value, bind:group)](https://svelte.dev/docs/svelte/element-directives#bind-value)
