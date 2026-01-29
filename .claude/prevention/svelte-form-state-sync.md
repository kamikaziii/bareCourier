# Prevention: Svelte 5 Form State Sync Issues

**Problem**: Form inputs lose values after submission when using `$state` initialized from props.

**Root Cause**: `$state` creates independent local state that doesn't auto-sync when props change.

**Cost**: Form appears broken, values don't update, user confusion, multiple bug reports.

---

## The One Rule

> **When form values come from props, ALWAYS use `$derived`, never `$state`**

---

## Quick Reference

```svelte
<!-- WRONG -->
let email = $state(props.email);      // Doesn't sync!

<!-- CORRECT -->
let email = $derived(props.email);    // Auto-syncs with prop changes
```

---

## Decision Flow

```
Form value from a prop?
  YES → Use $derived (always)
  NO  → Is it temporary UI state? (loading, error, etc.)
         YES → Use $state
         NO  → Is it derived from other values?
                YES → Use $derived
                NO  → Use $state
```

---

## Pattern Template

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // Form values from props: use $derived
  let email = $derived(data.profile?.email ?? '');
  let phone = $derived(data.profile?.phone ?? '');

  // Local UI state: use $state
  let isLoading = $state(false);
  let errors = $state<Record<string, string>>({});

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    const { error } = await data.supabase.from('profiles').update({ email, phone });
    if (error) errors['_general'] = error.message;
    isLoading = false;
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={email} />
  <input bind:value={phone} />
  {#if errors['_general']}
    <div class="text-destructive">{errors['_general']}</div>
  {/if}
  <button disabled={isLoading}>{isLoading ? 'Saving...' : 'Save'}</button>
</form>
```

---

## Test After Submission

After any form submission:

1. Parent updates the prop with new data
2. Form fields should auto-display the new values
3. No manual refresh needed
4. If fields don't update → missing `$derived`

---

## Code Review Red Flags

- [ ] `let X = $state(props.Y)` → Change to `$derived`
- [ ] `let X = $state(data.user?.field)` → Change to `$derived`
- [ ] {#key formProp} blocks → Use `$derived` instead
- [ ] Form doesn't update after submission → Check for `$state` on prop values

---

## Resources

- Full guide: [svelte-form-state.md](../rules/svelte-form-state.md)
- Code style: [code-style.md](../rules/code-style.md)
- Review checklist: [form-state-review.md](../checklists/form-state-review.md)

---

## Why This Matters

Without this pattern, forms appear to "lose" data after submission because:

1. Form uses `let email = $state(props.email)` (snapshots the value)
2. User edits and submits form
3. Backend confirms submission
4. Parent component updates props with new data
5. BUT child component's `$state` doesn't know about the change
6. Form continues showing submitted values, not the new data
7. User is confused: "Why didn't my submission work?"

Using `$derived` solves this automatically because the derived value always reflects the current prop value.
