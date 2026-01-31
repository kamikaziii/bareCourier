# Svelte 5 Form State Management

## Problem Summary

Form inputs lose their values after submission when using `$state` initialized from props. This happens because `$state` creates a local copy that doesn't automatically sync when props change.

**Example of the bug:**
```svelte
<script lang="ts">
  let { formData }: { formData: FormData } = $props();

  // WRONG: Local state doesn't sync when formData prop changes
  let email = $state(formData.email);
  let phone = $state(formData.phone);
</script>

<input bind:value={email} />
<input bind:value={phone} />
```

After form submission, the parent component updates `formData`, but the child component's local `$state` values remain unchanged, making the form appear to lose data.

## Solution: $derived for Prop-Based Values

Use `$derived` to automatically keep form values in sync with props:

```svelte
<script lang="ts">
  let { formData }: { formData: FormData } = $props();

  // CORRECT: Derived values auto-sync with prop changes
  let email = $derived(formData.email);
  let phone = $derived(formData.phone);

  // Local state: only for transient form UI state
  let isSubmitting = $state(false);
  let errors = $state<Record<string, string>>({});
</script>

<input bind:value={email} />
<input bind:value={phone} />
```

## $state vs $derived Decision Tree

Use this decision tree when deciding what type of state to use:

```
Does the value come from a prop?
├─ YES → Use $derived
│   └─ Value auto-syncs when prop changes
│   └─ Example: email = $derived(formData.email)
│
└─ NO → Use $state
    ├─ Is it temporary UI state (loading, errors, etc.)?
    │   └─ YES → Use $state
    │   └─ Examples: isSubmitting, errors, openDropdown
    │
    └─ Is it derived from other state?
        └─ YES → Use $derived instead
        └─ Example: const doubled = $derived(count * 2)
```

## Form State Management Patterns

### Pattern 1: Simple Form (Small Number of Fields)

Use `$derived` for each field:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Derived values from props
  let name = $derived(data.profile?.name ?? '');
  let email = $derived(data.profile?.email ?? '');

  // Local UI state
  let isLoading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    error = '';

    const { error: err } = await data.supabase
      .from('profiles')
      .update({ name, email })
      .eq('id', data.profile.id);

    if (err) {
      error = err.message;
    }

    isLoading = false;
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={name} type="text" />
  <input bind:value={email} type="email" />
  {#if error}
    <div class="text-destructive">{error}</div>
  {/if}
  <button disabled={isLoading}>
    {isLoading ? 'Saving...' : 'Save'}
  </button>
</form>
```

### Pattern 2: Complex Form (Many Fields)

Use a helper function to derive all fields at once:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Derive entire form object
  let formValues = $derived({
    name: data.profile?.name ?? '',
    email: data.profile?.email ?? '',
    phone: data.profile?.phone ?? '',
    address: data.profile?.address ?? ''
  });

  let isLoading = $state(false);
  let fieldErrors = $state<Record<string, string>>({});

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    fieldErrors = {};

    const { error: err } = await data.supabase
      .from('profiles')
      .update(formValues)
      .eq('id', data.profile.id);

    if (err) {
      fieldErrors['_general'] = err.message;
    }

    isLoading = false;
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={formValues.name} />
  <input bind:value={formValues.email} />
  <input bind:value={formValues.phone} />
  <input bind:value={formValues.address} />
  <!-- error display -->
</form>
```

### Pattern 3: Radio Buttons (Selection Form)

Radio buttons with `$derived` for initial selection:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Derive initial value from prop
  let selectedStatus = $derived(data.service?.status ?? 'pending');

  let isLoading = $state(false);
</script>

<fieldset>
  <legend>Status</legend>

  {#each ['pending', 'delivered'] as status}
    <label>
      <input
        type="radio"
        name="status"
        value={status}
        checked={selectedStatus === status}
        onchange={(e) => {
          selectedStatus = (e.target as HTMLInputElement).value;
        }}
      />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </label>
  {/each}
</fieldset>
```

### Pattern 4: Form with Validation

Separate display values from submission values:

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Display values (always in sync with props)
  let email = $derived(data.user?.email ?? '');

  // Validation state (local)
  let validationErrors = $state<Record<string, string>>({});
  let touched = $state<Record<string, boolean>>({});
  let isSubmitting = $state(false);

  function validateEmail(value: string): string | null {
    if (!value) return 'Email is required';
    if (!value.includes('@')) return 'Invalid email';
    return null;
  }

  function handleBlur(field: string, value: string) {
    touched[field] = true;
    const error = validateEmail(value);
    validationErrors[field] = error ?? '';
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    // Validate all fields
    const error = validateEmail(email);
    if (error) {
      validationErrors['email'] = error;
      return;
    }

    isSubmitting = true;
    // Submit...
    isSubmitting = false;
  }
</script>

<form onsubmit={handleSubmit}>
  <input
    bind:value={email}
    type="email"
    onblur={() => handleBlur('email', email)}
  />
  {#if touched['email'] && validationErrors['email']}
    <span class="text-destructive">{validationErrors['email']}</span>
  {/if}
</form>
```

## When to Use {#key} Blocks

{#key} blocks are for **resetting component state**, not for syncing with props.

### When {#key} IS Appropriate

Use {#key} when you need to completely reset a component:

```svelte
{#key data.userId}
  <!-- Form resets when userId changes -->
  <FormComponent {data} />
{/key}
```

### When {#key} is NOT Appropriate

Do NOT use {#key} as a workaround for state sync issues:

```svelte
<!-- WRONG: Using {#key} to force re-render -->
{#key formData}
  <input bind:value={email} />
{/key}

<!-- CORRECT: Use $derived instead -->
{#if formData}
  <input bind:value={email} />
{/if}
```

The issue with `{#key}` is that it destroys and recreates the entire component (wasteful) instead of just updating values (what `$derived` does).

## Code Review Checklist

When reviewing form components, check for:

- [ ] Form values derived from props use `$derived`, not `$state`
- [ ] Local UI state (isLoading, errors, touched) uses `$state`
- [ ] No `$state(prop.value)` pattern in the code
- [ ] No {#key} blocks used to force form resets (use navigation/page reload instead)
- [ ] After form submission, check if parent component updates props and child displays new values
- [ ] Test: Open form with data → submit → verify fields repopulate with new data

## Testing Strategy

### Manual Testing Steps

1. **Open form with initial data**
   - Load a form that receives data from props
   - Verify all fields display the correct values

2. **Submit form**
   - Fill form with new values
   - Submit the form
   - Verify submission succeeds

3. **Verify post-submission state**
   - After submission, parent updates the data prop
   - Child form should automatically display new values
   - Verify fields show the updated data (not the submitted values)

4. **Test with different data**
   - Change parent selection (different profile, service, etc.)
   - Form should reset to show selected item's data
   - No manual refresh needed

### Automated Testing (E2E)

```typescript
// Example Playwright test
test('form syncs with prop updates after submission', async ({ page }) => {
  // Load page with initial data
  await page.goto('/edit/profile/1');
  await expect(page.getByRole('textbox', { name: /email/i }))
    .toHaveValue('user@example.com');

  // Submit form with new email
  await page.getByRole('textbox', { name: /email/i })
    .fill('newemail@example.com');
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for submission
  await page.waitForURL('/edit/profile/1');

  // Verify form still shows new email (server echoed back)
  await expect(page.getByRole('textbox', { name: /email/i }))
    .toHaveValue('newemail@example.com');

  // Load different profile
  await page.getByRole('combobox', { name: /profile/i })
    .selectOption('2');

  // Form should update to show profile 2's data
  await expect(page.getByRole('textbox', { name: /email/i }))
    .toHaveValue('profile2@example.com');
});
```

## Quick Reference

| Scenario | Use This | Example |
|----------|----------|---------|
| Value from prop | `$derived` | `let email = $derived(data.user.email)` |
| Temporary UI state | `$state` | `let isLoading = $state(false)` |
| Computed from other state | `$derived` | `const total = $derived(price * quantity)` |
| Form validation errors | `$state` | `let errors = $state({})` |
| Initial value from prop | `$derived` | `let selected = $derived(data.item?.id ?? '')` |

## Related Resources

- [Svelte 5 Runes Guide](https://svelte.dev/docs/svelte/runes)
- [Reactive Mutation Prevention](./svelte-reactive-mutation-prevention.md) - Arrays/objects mutation patterns
- [Architecture Rules](./architecture.md) - Component structure patterns
- [Code Style Rules](./code-style.md) - General Svelte 5 syntax rules
