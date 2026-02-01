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
