# Form State Management - Quick Start Guide

**Problem**: Form inputs lose values after form submission
**Solution**: Use `$derived` for props, not `$state`
**Time to Fix**: 1 line of code

---

## The Fix (2 Minutes)

### Before (WRONG ❌)
```svelte
<script lang="ts">
  let { formData } = $props();
  let email = $state(formData.email);  // ❌ Doesn't sync after submission
</script>
```

### After (CORRECT ✓)
```svelte
<script lang="ts">
  let { formData } = $props();
  let email = $derived(formData.email);  // ✓ Auto-syncs with prop changes
</script>
```

---

## Copy & Paste Template

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // FORM VALUES: Derived from props
  let email = $derived(data.profile?.email ?? '');
  let name = $derived(data.profile?.name ?? '');
  let phone = $derived(data.profile?.phone ?? '');

  // UI STATE: Local state
  let isLoading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    error = '';

    const { error: err } = await data.supabase
      .from('profiles')
      .update({ email, name, phone })
      .eq('id', data.profile.id);

    if (err) {
      error = err.message;
    }

    isLoading = false;
  }
</script>

<form onsubmit={handleSubmit} class="space-y-4">
  <div>
    <label for="email">Email</label>
    <Input id="email" type="email" bind:value={email} />
  </div>

  <div>
    <label for="name">Name</label>
    <Input id="name" type="text" bind:value={name} />
  </div>

  <div>
    <label for="phone">Phone</label>
    <Input id="phone" type="tel" bind:value={phone} />
  </div>

  {#if error}
    <div class="text-destructive">{error}</div>
  {/if}

  <Button disabled={isLoading}>
    {isLoading ? 'Saving...' : 'Save'}
  </Button>
</form>
```

---

## Decision Tree (Bookmark This)

```
Does this value come from a prop?
│
├─ YES → Use $derived ✓
│
└─ NO
   ├─ Is it temporary UI state?
   │  (loading, error, touched, openDropdown, etc)
   │  └─ YES → Use $state ✓
   │
   └─ Is it derived from other state?
      └─ YES → Use $derived ✓
      └─ NO → Use $state ✓
```

---

## What to Look For in Code Review

### ❌ Anti-Pattern 1: `$state` with Prop Value
```svelte
let email = $state(props.email);     // WRONG
let email = $state(data.user?.name); // WRONG
```
→ Change to `$derived`

### ❌ Anti-Pattern 2: {#key} Workaround
```svelte
{#key formData}
  <input bind:value={email} />
{/key}
```
→ Use `$derived` instead, remove {#key}

### ❌ Anti-Pattern 3: Initial State from Prop
```svelte
let email = $state(userData.email ?? '');
// Later: userData changes, but email doesn't
```
→ Use `$derived`

### ✓ Correct Pattern: Derived + Local State
```svelte
let email = $derived(userData.email ?? '');    // From prop
let isLoading = $state(false);                 // Local UI state
let errors = $state<Record<string, string>>({}); // Local errors
```

---

## Test It (1 Minute)

After you fix a form:

1. Load the form with initial data ✓
2. Edit a field value ✓
3. Submit the form ✓
4. Verify field **auto-updates** with new value ✓
5. No manual page refresh needed ✓

If step 4 fails → component is still using `$state` instead of `$derived`

---

## Common Questions

**Q: Do I always use $derived for form values?**
A: YES. If a value comes from a prop, use `$derived`. No exceptions.

**Q: What about local form state?**
A: If it's not from props (like isLoading, errors, validation state), use `$state`.

**Q: Can I mix $state and $derived?**
A: Yes! Form values = `$derived`, UI state = `$state`.

**Q: Does {#key} help?**
A: No. It destroys/recreates the component. Use `$derived` instead.

---

## File Locations (Full Reference)

| Resource | File | Purpose |
|----------|------|---------|
| Quick Reference | `.claude/FORM_STATE_QUICK_START.md` | This guide |
| Complete Guide | `.claude/rules/svelte-form-state.md` | All patterns & details |
| Code Review | `.claude/checklists/form-state-review.md` | Checklist for reviews |
| Testing | `.claude/testing/form-state-testing.md` | Test examples |
| One-Page Summary | `.claude/prevention/svelte-form-state-sync.md` | Quick summary |
| Overview | `.claude/PREVENTION_STRATEGY.md` | Full prevention strategy |

---

## Related Rules

- See `.claude/rules/code-style.md` → Section "Form State Management"
- See `.claude/rules/architecture.md` → Component patterns
- See `.claude/rules/svelte-form-state.md` → Detailed patterns

---

## TL;DR

1. Form values from props? → `$derived`
2. Local UI state? → `$state`
3. After submit, does field auto-update? → Should be ✓
4. Not updating? → Check for `$state(props.X)` → fix to `$derived`

---

Created: 2026-01-29
Last Updated: 2026-01-29
