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
- [state_referenced_locally Prevention](./svelte-state-referenced-locally.md) - Complete guide for the warning
- [Reactive Mutation Prevention](./svelte-reactive-mutation-prevention.md) - Arrays/objects mutation patterns
- [Architecture Rules](./architecture.md) - Component structure patterns
- [Code Style Rules](./code-style.md) - General Svelte 5 syntax rules
# Svelte 5 Reactive Mutation Prevention Guide

## The Problem

In Svelte 5, mutating values created with `$derived` does **not** trigger reactivity. This is a common source of bugs, especially when working with arrays and objects.

### Anti-Pattern Example

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // ❌ WRONG: Creating derived array
  let items = $derived(data.items);

  function addItem() {
    items.push({ id: 1, name: 'New' }); // ❌ Mutation won't trigger reactivity
  }

  function removeItem(id: string) {
    items = items.filter(i => i.id !== id); // ✅ Reassignment works, but is inconsistent
  }
</script>

{#each items as item}
  <!-- UI won't update after addItem() -->
  <div>{item.name}</div>
{/each}
```

**Why this fails:**
- `$derived` creates a **read-only derived value**
- Mutations (`.push()`, `.splice()`, property assignment) don't trigger reactivity
- Reassignments (`.filter()`, `.map()`, `= [...]`) create new arrays and **do** work, but mixing both patterns is confusing

---

## Decision Tree: When to Use `$state` vs `$derived`

Use this tree **every time** you declare reactive state in a Svelte component:

```
1. Does this value come directly from a prop?
   ├─ YES → Use $derived
   │   └─ Examples:
   │       • let email = $derived(formData.email)
   │       • let services = $derived(data.services)
   │       • let config = $derived(profile.settings)
   │
   └─ NO → Continue to step 2

2. Is this a computed value based on other state?
   ├─ YES → Use $derived
   │   └─ Examples:
   │       • const total = $derived(price * quantity)
   │       • const filtered = $derived(items.filter(i => i.active))
   │       • const fullName = $derived(`${first} ${last}`)
   │
   └─ NO → Continue to step 3

3. Will this value be mutated (push, splice, property changes)?
   ├─ YES → Use $state AND reassign on mutation
   │   └─ Examples:
   │       • let items = $state([])
   │       • items = [...items, newItem]  // ✅ Reassign
   │       • items[0] = changed  // ❌ Mutation (won't work)
   │       • items[0] = changed; items = items  // ✅ Reassign
   │
   └─ NO → Use $state for local UI state
       └─ Examples:
           • let isLoading = $state(false)
           • let error = $state('')
           • let selectedId = $state(null)
```

---

## Correct Patterns for Arrays and Objects

### Pattern 1: Prop-Based Lists (Read-Only Display)

**Use Case:** Display data from props, no local mutations.

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // ✅ CORRECT: Derived from prop, no mutations
  let services = $derived(data.services);

  // ✅ Filtering/sorting creates new arrays (safe)
  const activeServices = $derived(services.filter(s => s.active));
  const sorted = $derived([...activeServices].sort((a, b) => a.id - b.id));
</script>

{#each sorted as service}
  <ServiceCard {service} />
{/each}
```

**Key:** `$derived` is perfect when you **never mutate** the value.

---

### Pattern 2: Local Stateful Lists (Mutations Required)

**Use Case:** Client-side form arrays, todo lists, dynamic filters.

```svelte
<script lang="ts">
  let { initialItems }: { initialItems: Item[] } = $props();

  // ✅ CORRECT: Use $state for local mutations
  let items = $state<Item[]>([...initialItems]);

  function addItem(item: Item) {
    // ✅ Reassignment triggers reactivity
    items = [...items, item];
  }

  function removeItem(id: string) {
    // ✅ Reassignment triggers reactivity
    items = items.filter(i => i.id !== id);
  }

  function updateItem(id: string, changes: Partial<Item>) {
    // ✅ Reassignment triggers reactivity
    items = items.map(i => i.id === id ? { ...i, ...changes } : i);
  }
</script>
```

**Key:** Use `$state` + **immutable update patterns** (spread, map, filter).

---

### Pattern 3: Derived Filters (Non-Mutating Transformations)

**Use Case:** Filter/sort/transform data without changing the source.

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // ✅ Base data from props
  let services = $derived(data.services);

  // ✅ Local filter state
  let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');
  let searchQuery = $state('');

  // ✅ Derived filters (no mutations)
  const filteredServices = $derived.by(() => {
    let result = services;

    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    if (searchQuery) {
      result = result.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  });
</script>
```

**Key:** Use `$derived.by()` for complex multi-step transformations.

---

### Pattern 4: Objects (Settings, Configuration)

```svelte
<script lang="ts">
  let { profile }: { profile: Profile } = $props();

  // ✅ Derive read-only values from props
  let email = $derived(profile.email);
  let name = $derived(profile.name);

  // ❌ WRONG: Deriving object for mutation
  let settings = $derived(profile.settings);
  settings.theme = 'dark'; // Won't trigger reactivity

  // ✅ CORRECT: Use $state for local object mutations
  let settings = $state({ ...profile.settings });

  function updateTheme(theme: string) {
    // ✅ Reassign the entire object
    settings = { ...settings, theme };
  }
</script>
```

---

## Code Review Checklist

When reviewing Svelte components, check for these patterns:

### Red Flags (High Priority)

- [ ] **`$derived` with array/object + mutation operations**
  ```svelte
  let items = $derived(data.items);
  items.push(newItem); // ❌ BUG: Mutation won't trigger reactivity
  ```

- [ ] **Mixed mutation + reassignment patterns**
  ```svelte
  let items = $derived(data.items);
  items[0] = changed; // ❌ Mutation
  items = items.filter(i => i.active); // ✅ Reassignment
  // Confusing: Some updates work, some don't
  ```

- [ ] **Prop-based `$state` without sync logic**
  ```svelte
  let { formData } = $props();
  let email = $state(formData.email); // ❌ Won't sync on prop changes
  ```

### Green Patterns (Good)

- [x] **`$derived` from props (read-only)**
  ```svelte
  let services = $derived(data.services);
  const filtered = $derived(services.filter(s => s.active));
  ```

- [x] **`$state` with immutable updates**
  ```svelte
  let items = $state<Item[]>([]);
  items = [...items, newItem];
  ```

- [x] **`$state` for UI state (primitives)**
  ```svelte
  let isLoading = $state(false);
  let error = $state('');
  ```

---

## Testing Strategy

### 1. Manual Testing

**Test Case: Array Mutation After Prop Update**

1. **Setup:** Component receives array prop, derives local state
2. **Action:** Trigger parent prop update
3. **Verify:** Derived value updates in UI
4. **Action:** Mutate derived array (`.push()`, `.splice()`)
5. **Expected:** UI does **not** update (confirms derived is read-only)

**Example Test:**
```typescript
// DataTab.svelte
let services = $derived(data.services); // From prop

// In test:
// 1. Load initial services → UI shows 5 items
// 2. Parent updates prop → UI shows 10 items ✅
// 3. Call services.push(newItem) → UI still shows 10 items ❌ (expected)
```

---

### 2. Automated Testing (E2E)

```typescript
// tests/derived-mutation.spec.ts
import { test, expect } from '@playwright/test';

test('derived arrays should not mutate', async ({ page }) => {
  await page.goto('/services');

  // Initial state
  const initialCount = await page.locator('[data-testid="service-item"]').count();

  // Trigger prop update
  await page.getByRole('button', { name: /refresh/i }).click();
  await page.waitForLoadState('networkidle');

  // New count should reflect prop change
  const newCount = await page.locator('[data-testid="service-item"]').count();
  expect(newCount).toBeGreaterThan(initialCount);

  // If component had mutation bugs, count would be stale here
});
```

---

### 3. Unit Testing (Component Testing)

```typescript
// tests/ServiceList.test.ts
import { render } from '@testing-library/svelte';
import ServiceList from '$lib/components/ServiceList.svelte';

test('list updates when prop changes', async () => {
  const { component, rerender } = render(ServiceList, {
    props: { services: [{ id: 1, name: 'A' }] }
  });

  expect(screen.getByText('A')).toBeInTheDocument();

  // Update prop
  await rerender({ services: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] });

  expect(screen.getByText('B')).toBeInTheDocument();
});
```

---

## Linting Rules and Patterns to Watch

### Automated Detection Script

The project includes a bash script to detect $derived mutation anti-patterns:

```bash
./.claude/tools/detect-derived-mutations.sh
```

**What it checks:**
- Array mutation methods: `.push()`, `.pop()`, `.splice()`, `.shift()`, `.unshift()`, `.sort()`, `.reverse()`
- Direct index assignment: `array[index] = value`

**Example output:**
```
⚠️  POTENTIAL BUG: src/routes/example/+page.svelte
   Variable 'items' is $derived but has array mutation:
   45:     items.push(newItem);  // ❌ Won't trigger reactivity
```

**Usage in CI/CD:**
```yaml
# .github/workflows/ci.yml
- name: Check for $derived mutations
  run: ./.claude/tools/detect-derived-mutations.sh
```

---

### ESLint Custom Rule (Future Enhancement)

```javascript
// .eslintrc.js (conceptual)
{
  rules: {
    'no-derived-mutation': {
      // Flag: let x = $derived(...); x.push(...);
      // Flag: let x = $derived(...); x[0] = ...;
      // Allow: let x = $derived(...); x = x.filter(...);
    }
  }
}
```

**Note:** Svelte's compiler doesn't currently provide this lint rule. Use the detection script above or manual code review.

---

### Search Patterns for Code Review

**Find all `$derived` array declarations:**
```bash
rg 'let \w+ = \$derived\(.*\[' src/
```

**Find potential mutations:**
```bash
rg '\.push\(|\.splice\(|\.pop\(|\.shift\(|\.unshift\(' src/
```

**Cross-reference:** Check if variable is `$derived`.

---

## Common Mistakes and Solutions

### Mistake 1: Filtering Props Into Local State

```svelte
<!-- ❌ WRONG -->
<script lang="ts">
  let { data } = $props();
  let activeItems = $derived(data.items.filter(i => i.active));

  function toggleActive(id: string) {
    const item = activeItems.find(i => i.id === id);
    item.active = !item.active; // ❌ Mutation
  }
</script>
```

**Fix:**
```svelte
<!-- ✅ CORRECT -->
<script lang="ts">
  let { data } = $props();

  // Option 1: Keep filter as derived, update source
  let activeItems = $derived(data.items.filter(i => i.active));

  async function toggleActive(id: string) {
    // Update database (source of truth)
    await supabase.from('items').update({ active: !active }).eq('id', id);
    // Parent refetches and updates prop
  }

  // Option 2: Use local $state if updates are client-side only
  let items = $state([...data.items]);
  const activeItems = $derived(items.filter(i => i.active));

  function toggleActive(id: string) {
    items = items.map(i =>
      i.id === id ? { ...i, active: !i.active } : i
    );
  }
</script>
```

---

### Mistake 2: Spreading Derived Arrays for Mutation

```svelte
<!-- ❌ WRONG (still confusing) -->
<script lang="ts">
  let services = $derived(data.services);

  function addService(service: Service) {
    services = [...services, service]; // ✅ Works, but confusing
    // Why? services is derived, but reassignment is allowed
    // However, future developers might try services.push()
  }
</script>
```

**Fix:**
```svelte
<!-- ✅ CORRECT (clear intent) -->
<script lang="ts">
  // If you need mutations, use $state from the start
  let services = $state<Service[]>([...data.services]);

  // Sync with props manually if needed
  $effect(() => {
    services = [...data.services];
  });

  function addService(service: Service) {
    services = [...services, service]; // Clear: $state allows mutations via reassignment
  }
</script>
```

---

### Mistake 3: Derived Object Mutations

```svelte
<!-- ❌ WRONG -->
<script lang="ts">
  let { profile } = $props();
  let settings = $derived(profile.settings);

  function updateTheme(theme: string) {
    settings.theme = theme; // ❌ Won't trigger reactivity
  }
</script>
```

**Fix:**
```svelte
<!-- ✅ CORRECT -->
<script lang="ts">
  let { profile } = $props();
  let settings = $state({ ...profile.settings });

  function updateTheme(theme: string) {
    settings = { ...settings, theme }; // ✅ Reassignment
  }
</script>
```

---

## Quick Reference Table

| Scenario | Use This | Pattern | Why |
|----------|----------|---------|-----|
| Display prop data | `$derived` | `let items = $derived(data.items)` | Read-only, syncs automatically |
| Filter/sort prop data | `$derived` | `const filtered = $derived(items.filter(...))` | Non-mutating transformation |
| Local form array | `$state` | `let items = $state([])` | Needs mutations (add/remove) |
| Computed value | `$derived` | `const total = $derived(sum(items))` | Pure calculation |
| UI toggle state | `$state` | `let open = $state(false)` | Local boolean |
| Loading/error state | `$state` | `let loading = $state(true)` | Local UI state |
| Form field from prop | `$derived` | `let email = $derived(data.user.email)` | Syncs with parent updates |
| Editable form field | `$state` | `let email = $state('')` | User can edit |

---

## Migration Checklist

When refactoring existing code:

1. [ ] **Identify all `$derived` declarations**
   ```bash
   rg 'let \w+ = \$derived' src/
   ```

2. [ ] **For each `$derived` array/object:**
   - [ ] Check if it's mutated anywhere (`.push()`, `.splice()`, property assignment)
   - [ ] If yes, convert to `$state` with immutable updates
   - [ ] If no, confirm it's truly read-only

3. [ ] **Check for mixed patterns:**
   - [ ] Search for both mutation + reassignment on same variable
   - [ ] Pick one pattern: either `$state` (mutations) or `$derived` (read-only)

4. [ ] **Test reactivity:**
   - [ ] After changes, verify UI updates correctly
   - [ ] Test prop updates (parent → child sync)
   - [ ] Test local mutations (add/remove items)

---

## Real-World Example (From Codebase)

### Before (Potential Bug)

```svelte
<script lang="ts">
  let { data } = $props();
  let services = $derived(data.services);

  // If we later add:
  function deleteService(id: string) {
    const index = services.findIndex(s => s.id === id);
    services.splice(index, 1); // ❌ BUG: Won't update UI
  }
</script>
```

### After (Correct)

```svelte
<script lang="ts">
  let { data } = $props();

  // Option 1: Keep derived, update source of truth
  let services = $derived(data.services);

  async function deleteService(id: string) {
    await supabase.from('services').delete().eq('id', id);
    // Parent refetches, prop updates, derived updates ✅
  }

  // Option 2: Use $state for client-side mutations
  let services = $state<Service[]>([...data.services]);

  $effect(() => {
    services = [...data.services]; // Sync with prop updates
  });

  function deleteService(id: string) {
    services = services.filter(s => s.id !== id); // ✅ Works
  }
</script>
```

---

## Related Resources

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/runes)
- [state_referenced_locally Prevention](./svelte-state-referenced-locally.md) - The `$state(prop)` warning guide
- [svelte-form-state.md](./svelte-form-state.md) - Form-specific state patterns
- [code-style.md](./code-style.md) - General coding conventions
- [architecture.md](./architecture.md) - Component architecture patterns

---

## Summary

**Golden Rule:**
- **`$derived` = Read-Only** (no mutations, only transformations)
- **`$state` = Mutable** (use immutable update patterns for arrays/objects)

**When in doubt:**
1. Ask: "Will I mutate this?"
2. If yes → `$state` + reassignment
3. If no → `$derived`

**Always prefer immutable updates** for arrays/objects, even with `$state`.
# Svelte 5 `state_referenced_locally` Warning Prevention Guide

## Overview

The `state_referenced_locally` warning appears when you initialize `$state` with a value from props. This pattern creates a **one-time snapshot** that doesn't automatically sync when props change, which can lead to silent bugs.

```svelte
<!-- Warning: State referenced in its own scope will not update -->
let name = $state(profile.name);  // ⚠️ Captures initial value only
```

This guide provides strategies for recognizing when this pattern is needed, how to handle it safely, and how to catch issues during code review.

---

## Part 1: Best Practices - Recognizing When to Use `$state(prop)`

### The Core Question

Ask yourself: **"Does the user need to modify this value independently of the prop?"**

| Answer | Solution | Why |
|--------|----------|-----|
| **No** - Read-only display | Use `$derived` | Auto-syncs with prop changes |
| **Yes** - User edits the value | Use `$state(prop)` + sync strategy | Needs local copy for editing |

### Legitimate Use Cases for `$state(prop)`

#### 1. Editable Form Fields

When users need to modify a value that comes from props:

```svelte
<script lang="ts">
  let { profile }: { profile: Profile } = $props();

  // ✅ CORRECT: User needs to edit this value
  // svelte-ignore state_referenced_locally
  let name = $state(profile.name);
  let phone = $state(profile.phone);

  // Sync when prop changes (after form submission + invalidateAll)
  $effect(() => {
    name = profile.name;
    phone = profile.phone;
  });
</script>

<input bind:value={name} />
<input bind:value={phone} />
```

#### 2. Local Copy for Complex State

When you need to transform or accumulate changes before submitting:

```svelte
<script lang="ts">
  let { initialZones }: { initialZones: Zone[] } = $props();

  // ✅ CORRECT: Local copy for add/remove/edit operations
  // svelte-ignore state_referenced_locally
  let zones = $state([...initialZones]);

  // Sync when parent provides new data
  $effect(() => {
    zones = [...initialZones];
  });

  function addZone() {
    zones = [...zones, { min_km: 0, max_km: 10, price: 5 }];
  }
</script>
```

#### 3. Edit Pages with `{#key}` Component Reset

When navigating between different entities (e.g., editing service 1 vs service 2):

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally - safe because {#key data.service.id} forces re-creation
  const service = data.service;

  // These capture initial values - safe with {#key}
  let pickupLocation = $state(service.pickup_location);
  let notes = $state(service.notes || '');
</script>

<!-- Force component re-creation when service ID changes -->
{#key data.service.id}
<form>
  <input bind:value={pickupLocation} />
</form>
{/key}
```

### When NOT to Use `$state(prop)`

#### Display-Only Values

```svelte
<!-- ❌ WRONG: No editing needed -->
let name = $state(profile.name);
<p>{name}</p>

<!-- ✅ CORRECT: Use $derived for display -->
let name = $derived(profile.name);
<p>{name}</p>
```

#### Computed/Filtered Data

```svelte
<!-- ❌ WRONG: Computing from prop -->
let activeServices = $state(data.services.filter(s => s.active));

<!-- ✅ CORRECT: Use $derived for transformations -->
let activeServices = $derived(data.services.filter(s => s.active));
```

---

## Part 2: Decision Tree

Use this decision tree for EVERY reactive declaration:

```
┌─────────────────────────────────────────────────────────────────┐
│  Does the value come from a prop?                               │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ NO ──► Use $state for local values
         │         let isLoading = $state(false);
         │         let error = $state('');
         │
         └─ YES ──► Continue below
                    │
    ┌───────────────┴───────────────┐
    │  Will the user EDIT this      │
    │  value in a form/input?       │
    └───────────────────────────────┘
              │
              ├─ NO ──► Use $derived
              │         let email = $derived(profile.email);
              │         let services = $derived(data.services);
              │
              └─ YES ──► Continue below
                         │
    ┌────────────────────┴────────────────────┐
    │  Is component re-created on navigation  │
    │  (using {#key data.entity.id})?         │
    └─────────────────────────────────────────┘
              │
              ├─ YES ──► $state(prop) is safe
              │          // svelte-ignore state_referenced_locally
              │          let name = $state(profile.name);
              │
              └─ NO ──► Need sync strategy (see below)
```

### Sync Strategies for Editable Forms

#### Strategy 1: `$effect` Sync (Recommended)

Use when the component stays mounted and props can change:

```svelte
<script lang="ts">
  let { profile }: { profile: Profile } = $props();

  // svelte-ignore state_referenced_locally
  let name = $state(profile.name || '');
  // svelte-ignore state_referenced_locally
  let phone = $state(profile.phone || '');

  // Sync local state when prop changes
  $effect(() => {
    name = profile.name || '';
    phone = profile.phone || '';
  });
</script>
```

**When to use:**
- Settings pages where form stays mounted
- Tab components that share data
- After `invalidateAll()` refreshes parent data

#### Strategy 2: `{#key}` Component Reset (Recommended for Edit Pages)

Use when navigating between different entities:

```svelte
{#key data.service.id}
<ServiceEditForm {data} />
{/key}
```

**When to use:**
- Edit pages for different entities (`/services/[id]/edit`)
- Client detail pages (`/clients/[id]`)
- Any route with dynamic params that changes the data entirely

**Benefit:** Component is destroyed and recreated, so `$state(prop)` captures fresh values.

#### Strategy 3: Controlled Props Pattern

Use when parent needs to control state:

```svelte
<!-- Parent -->
<ChildForm
  value={formData.email}
  onValueChange={(v) => formData.email = v}
/>

<!-- Child -->
<script lang="ts">
  let { value, onValueChange }: {
    value: string;
    onValueChange: (v: string) => void;
  } = $props();
</script>

<input
  value={value}
  oninput={(e) => onValueChange(e.currentTarget.value)}
/>
```

**When to use:**
- Reusable form components
- Complex forms with validation logic in parent
- When you need single source of truth

---

## Part 3: Code Review Checklist

### For Every `$state(prop)` Instance

- [ ] **Is `$derived` more appropriate?** If the value is display-only, use `$derived`
- [ ] **Is sync strategy documented?** Look for either:
  - `{#key}` wrapping the component/form
  - `$effect()` that syncs the state with props
  - Comment explaining why sync isn't needed
- [ ] **Is ignore comment present with justification?**
  ```svelte
  // svelte-ignore state_referenced_locally - safe because {#key data.id} forces re-creation
  let name = $state(data.name);
  ```
- [ ] **Test prop updates:** After form submission with `invalidateAll()`, does the form show updated values?

### Red Flags to Watch For

```svelte
<!-- 🚩 RED FLAG: No sync strategy visible -->
let items = $state(data.items);  // Where's the sync?

<!-- 🚩 RED FLAG: Multiple ignores without $effect -->
// svelte-ignore state_referenced_locally
let name = $state(profile.name);
// svelte-ignore state_referenced_locally
let phone = $state(profile.phone);
// No $effect to sync!

<!-- 🚩 RED FLAG: Derived used with bind:value -->
let name = $derived(profile.name);
<input bind:value={name} />  // Won't work! $derived is read-only
```

### Green Patterns (Approved)

```svelte
<!-- ✅ Pattern 1: $effect sync -->
// svelte-ignore state_referenced_locally
let name = $state(profile.name);
$effect(() => { name = profile.name; });

<!-- ✅ Pattern 2: {#key} reset -->
{#key data.service.id}
// svelte-ignore state_referenced_locally
let notes = $state(service.notes);
{/key}

<!-- ✅ Pattern 3: Display-only with $derived -->
let name = $derived(profile.name);
<p>{name}</p>
```

### Quick Review Questions

1. **"Does this form stay mounted when props change?"**
   - Yes → Need `$effect` sync
   - No (navigating to different entity) → `{#key}` is sufficient

2. **"What happens when the user submits and `invalidateAll()` runs?"**
   - If form should show new data → Need sync strategy
   - If form is destroyed/recreated → `{#key}` handles it

3. **"Is the ignore comment justified?"**
   - Must explain WHY it's safe (e.g., "safe because {#key} forces re-creation")
   - If no justification, request one

---

## Part 4: Linting and Detection

### Detection Script

Create `.claude/tools/detect-state-referenced-locally.sh`:

```bash
#!/bin/bash
# detect-state-referenced-locally.sh
# Detects potential $state(prop) patterns without proper sync

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT" || exit 1

echo "🔍 Scanning for potential \$state(prop) issues..."
echo ""

TEMP_RESULTS=$(mktemp)
trap 'rm -f $TEMP_RESULTS' EXIT

ISSUES_FOUND=0

for file in $(find src -name '*.svelte' -type f); do
    # Skip if no $state with prop reference
    if ! grep -q '\$state(' "$file" 2>/dev/null; then
        continue
    fi

    # Check for $state initialized from common prop patterns
    # e.g., $state(profile.name), $state(data.service.notes)
    PROP_STATES=$(grep -n '\$state([a-zA-Z_][a-zA-Z0-9_]*\.' "$file" 2>/dev/null || true)

    if [ -z "$PROP_STATES" ]; then
        continue
    fi

    # Check if file has sync strategy
    HAS_EFFECT_SYNC=$(grep -c '\$effect.*=' "$file" 2>/dev/null || echo "0")
    HAS_KEY_BLOCK=$(grep -c '{#key' "$file" 2>/dev/null || echo "0")
    HAS_IGNORE=$(grep -c 'svelte-ignore state_referenced_locally' "$file" 2>/dev/null || echo "0")

    # Count $state(prop) instances
    STATE_PROP_COUNT=$(echo "$PROP_STATES" | wc -l | tr -d ' ')

    if [ "$HAS_EFFECT_SYNC" -eq 0 ] && [ "$HAS_KEY_BLOCK" -eq 0 ]; then
        {
            echo "⚠️  POTENTIAL BUG: $file"
            echo "   Found $STATE_PROP_COUNT \$state(prop) pattern(s) without sync strategy:"
            echo "$PROP_STATES" | head -5 | sed 's/^/   /'
            if [ "$HAS_IGNORE" -gt 0 ]; then
                echo "   Note: Has svelte-ignore but no \$effect or {#key} for sync"
            fi
            echo ""
        } >> "$TEMP_RESULTS"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    elif [ "$HAS_IGNORE" -eq 0 ] && [ "$STATE_PROP_COUNT" -gt 0 ]; then
        {
            echo "📝 INFO: $file"
            echo "   Has \$state(prop) pattern(s) - verify sync strategy is correct:"
            echo "$PROP_STATES" | head -3 | sed 's/^/   /'
            echo ""
        } >> "$TEMP_RESULTS"
    fi
done

if [ -s "$TEMP_RESULTS" ]; then
    cat "$TEMP_RESULTS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "💡 How to fix:"
    echo ""
    echo "1. If value is DISPLAY-ONLY, use \$derived:"
    echo "   let name = \$derived(profile.name);"
    echo ""
    echo "2. If value is EDITABLE, add sync strategy:"
    echo ""
    echo "   Option A: Use \$effect to sync"
    echo "   // svelte-ignore state_referenced_locally"
    echo "   let name = \$state(profile.name);"
    echo "   \$effect(() => { name = profile.name; });"
    echo ""
    echo "   Option B: Use {#key} for component reset"
    echo "   {#key data.entity.id}"
    echo "   <FormComponent {data} />"
    echo "   {/key}"
    echo ""
    echo "📖 See .claude/rules/svelte-state-referenced-locally.md for details"

    if [ "$ISSUES_FOUND" -gt 0 ]; then
        exit 1
    fi
else
    echo "✅ No obvious \$state(prop) issues detected"
    exit 0
fi
```

### Integration with CI/CD

Add to `.github/workflows/ci.yml`:

```yaml
- name: Check for $state(prop) issues
  run: |
    chmod +x .claude/tools/detect-state-referenced-locally.sh
    ./.claude/tools/detect-state-referenced-locally.sh
```

### svelte-check Configuration

The Svelte compiler already warns about this. Ensure warnings are not ignored:

```json
// svelte.config.js
export default {
  compilerOptions: {
    // Don't disable warnings globally
    // warningFilter: (warning) => true  // ❌ Don't do this
  }
};
```

### Editor Integration (VS Code)

The Svelte extension will show warnings in the editor. Configure to not auto-suppress:

```json
// .vscode/settings.json
{
  "svelte.plugin.svelte.compilerWarnings": {
    "state_referenced_locally": "error"  // Treat as error in editor
  }
}
```

---

## Part 5: Testing Strategy

### Manual Testing Protocol

1. **Load the form** with initial data
2. **Edit a field** (don't submit yet)
3. **Trigger a prop update** (e.g., another tab submits, or `invalidateAll()`)
4. **Verify:** Does the form show the NEW prop value or the OLD edited value?
   - Expected: Shows NEW prop value (sync is working)
   - Bug: Shows OLD/stale value (sync is broken)

### Automated E2E Test

```typescript
// tests/state-sync.spec.ts
import { test, expect } from '@playwright/test';

test('form syncs after prop update', async ({ page }) => {
  // Load settings page
  await page.goto('/courier/settings');

  // Get initial value
  const nameInput = page.locator('input[name="name"]');
  const initialName = await nameInput.inputValue();

  // Edit the field
  await nameInput.fill('Test Name Change');

  // Submit form (triggers invalidateAll)
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for response
  await page.waitForResponse(resp => resp.url().includes('/settings'));

  // Verify form shows the saved value (from prop), not intermediate edit
  // This tests that $effect sync is working
  const newValue = await nameInput.inputValue();
  expect(newValue).toBe('Test Name Change'); // Should match what was saved
});

test('edit page resets on navigation', async ({ page }) => {
  // Load service 1 edit page
  await page.goto('/courier/services/service-1/edit');
  const notesInput = page.locator('input[name="notes"]');
  await notesInput.fill('Notes for service 1');

  // Navigate to service 2 edit page (same component, different data)
  await page.goto('/courier/services/service-2/edit');

  // Verify form shows service 2 data, not service 1 edits
  const newNotes = await notesInput.inputValue();
  expect(newNotes).not.toBe('Notes for service 1');
});
```

---

## Part 6: Reference Examples from Codebase

### Example 1: AccountTab.svelte (Settings with `$effect` sync)

```svelte
// Location: src/routes/courier/settings/AccountTab.svelte

// svelte-ignore state_referenced_locally
let warehouseAddress = $state(profile.default_pickup_location || '');
// svelte-ignore state_referenced_locally
let warehouseCoords = $state<[number, number] | null>(...);

// Sync local state when profile updates (after form submission + invalidateAll)
$effect(() => {
  warehouseAddress = profile.default_pickup_location || '';
  warehouseCoords = profile.warehouse_lat && profile.warehouse_lng
    ? [profile.warehouse_lng, profile.warehouse_lat]
    : null;
});
```

**Why this works:** After form submission, `invalidateAll()` refreshes the `profile` prop, and `$effect` syncs the local state.

### Example 2: Service Edit Page (with `{#key}` reset)

```svelte
// Location: src/routes/client/services/[id]/edit/+page.svelte

// svelte-ignore state_referenced_locally - safe because {#key data.service.id} forces re-creation
const service = data.service;

let pickupLocation = $state(service.pickup_location);
let notes = $state(service.notes || '');

// Template
{#key data.service.id}
<form>
  <!-- Form content -->
</form>
{/key}
```

**Why this works:** When navigating from `/services/1/edit` to `/services/2/edit`, the `{#key}` block destroys and recreates the entire form, causing fresh `$state` initialization.

### Example 3: SchedulingTab.svelte (Complex objects with `$effect`)

```svelte
// Location: src/routes/courier/settings/SchedulingTab.svelte

// svelte-ignore state_referenced_locally
let pastDueSettings = $state<PastDueSettings>(profile.past_due_settings ?? defaultPastDueSettings);
// svelte-ignore state_referenced_locally
let timeSlots = $state<TimeSlotDefinitions>(profile.time_slots ?? defaultTimeSlots);
// svelte-ignore state_referenced_locally
let workingDays = $state<WorkingDay[]>(profile.working_days ?? defaultWorkingDays);

// Sync with props after form submission
$effect(() => {
  pastDueSettings = profile.past_due_settings ?? defaultPastDueSettings;
  timeSlots = profile.time_slots ?? defaultTimeSlots;
  workingDays = profile.working_days ?? defaultWorkingDays;
});
```

**Why this works:** Even complex objects sync correctly when the `$effect` reassigns the entire object.

---

## Quick Reference Table

| Scenario | Pattern | Sync Strategy |
|----------|---------|---------------|
| Display profile name | `$derived(profile.name)` | None needed |
| Edit profile name | `$state(profile.name)` | `$effect` sync |
| Edit service (route param) | `$state(service.notes)` | `{#key data.service.id}` |
| Filter/sort services | `$derived(data.services.filter(...))` | None needed |
| Local form array (zones) | `$state([...initialZones])` | `$effect` sync |
| Loading/error state | `$state(false)` | None needed (local) |

---

## Summary

1. **Default to `$derived`** for prop-based values
2. **Use `$state(prop)` only when** the user needs to edit the value
3. **Always add a sync strategy** (`$effect` or `{#key}`)
4. **Document with ignore comment** explaining why it's safe
5. **Test prop updates** to verify sync works

The warning exists to protect you from subtle bugs. Never suppress it without a sync strategy.
