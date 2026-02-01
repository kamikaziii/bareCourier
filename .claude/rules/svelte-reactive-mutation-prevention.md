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
