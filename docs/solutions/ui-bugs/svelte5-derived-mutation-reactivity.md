---
title: "Service Status Update Button Not Reflecting Changes Without Page Refresh"
date: 2026-01-30
tags:
  - svelte
  - svelte-5
  - runes
  - reactivity
  - state-management
  - ui-bugs
  - derived-state
  - supabase
component: courier-dashboard
affected_components:
  - src/routes/courier/+page.svelte
  - src/lib/components/WorkloadCard.svelte
severity: high
symptoms:
  - Clicking status change button appears to succeed but UI doesn't update
  - Service card status badge remains unchanged after button click
  - Page refresh required to see status changes
  - Workload component causes cumulative layout shift during reload
frameworks:
  - svelte
  - sveltekit
  - supabase
version_introduced: Unknown
version_fixed: 5.45.6
root_cause: |
  Using $derived for arrays that need to be mutated locally. When $derived
  creates a reactive reference, mutations are lost when the source prop updates.
  The optimistic update works temporarily but gets overwritten when invalidate()
  refetches data.
solution_type: state-management-pattern
keywords:
  - reactive-state
  - prop-synchronization
  - derived-vs-state
  - svelte-5-runes
  - optimistic-updates
related_docs:
  - .claude/rules/svelte-form-state.md
  - .claude/rules/code-style.md
  - docs/solutions/form-handling/svelte5-form-inputs-losing-values-after-submission.md
---

# Service Status Update Not Reflecting in UI

## Problem Description

Users clicking the status change button on service cards would see the button appear to work (loading spinner, no errors), but the UI wouldn't update to reflect the new status until they manually refreshed the page. Additionally, the workload component would cause the entire page to shift vertically during reload, creating a jarring user experience.

## Symptoms

- ✗ Service card status badge doesn't update after clicking toggle button
- ✗ Loading indicator appears, then disappears, but status remains unchanged
- ✗ Page refresh reveals the status did change in the database
- ✗ Workload card collapses/expands during reload causing layout shift
- ✗ Cards jump vertically when workload updates

## Root Cause

Services list was declared using `$derived(data.services)`. When the user toggles status:

1. Code mutates the array: `services[index] = { ...service, status: 'delivered' }`
2. Mutation appears to work locally
3. `invalidate('app:services')` refetches data from server
4. `$derived` re-evaluates and **overwrites** local mutation with original server data
5. UI reverts to old status, making the change invisible

**Key insight from Svelte 5 docs:**
> "`$derived` is designed for read-only computed values."

The workload card was also being destroyed and recreated during reload, causing vertical layout shifts

## Solution

### Fix 1: Change Services from `$derived` to `$state` with Sync Effect

**File**: `src/routes/courier/+page.svelte`

**Before** (Line 37):
```typescript
let services = $derived(data.services);  // ❌ Read-only, loses mutations
```

**After** (Lines 37-42):
```typescript
let services = $state<ServiceWithProfile[]>(data.services);  // ✅ Mutable local copy

// Sync services when data changes (e.g., after invalidate)
$effect(() => {
	services = data.services;
});
```

**How it works**:
1. `$state` creates a mutable local copy for optimistic updates
2. When `toggleStatus()` mutates `services[index]`, change persists in local state
3. UI updates immediately (optimistic)
4. When `invalidate('app:services')` refetches, `$effect` detects `data.services` changed
5. `$effect` updates local `services` with fresh server data
6. UI syncs with server truth

### Fix 2: Add Loading Prop to WorkloadCard

**File**: `src/lib/components/WorkloadCard.svelte`

**Before** (Lines 11-12):
```typescript
interface Props {
	workload: WorkloadEstimate;  // ❌ No loading state
}
```

**After** (Lines 11-13):
```typescript
interface Props {
	workload: WorkloadEstimate;
	loading?: boolean;  // ✅ Optional loading state
}
```

**Before** (Line 36):
```svelte
<Card.Root class="{styles.bg} {cardExpanded ? '' : '!py-0 !gap-0'}">
	<Collapsible.Trigger class="w-full text-left">
		<span class="flex items-center gap-2">
			<StatusIcon class="size-5 {styles.text}" />
```

**After** (Lines 37-43):
```svelte
<Card.Root class="{styles.bg} {cardExpanded ? '' : '!py-0 !gap-0'} {loading ? 'opacity-50' : ''}">
	<Collapsible.Trigger class="w-full text-left" disabled={loading}>
		<span class="flex items-center gap-2">
			{#if loading}
				<Loader2 class="size-5 animate-spin {styles.text}" />
			{:else}
				<StatusIcon class="size-5 {styles.text}" />
			{/if}
```

**Parent usage** (src/routes/courier/+page.svelte):

**Before**:
```svelte
{#if workloadLoading}
	<SkeletonCard variant="stat" />  // ❌ Destroys component
{:else if workload}
	<WorkloadCard {workload} />
{/if}
```

**After**:
```svelte
{#if workloadLoading && !workload}
	<SkeletonCard variant="stat" />  // Only on initial load
{:else if workload}
	<WorkloadCard {workload} loading={workloadLoading} />  // ✅ Keep mounted
{/if}
```

## Prevention

### Decision Tree: When to Use `$state` vs `$derived`

```
Does this value come from a prop?
├─ YES
│  ├─ Will you mutate it locally? (array mutations, property changes)
│  │  └─ YES → Use $state with $effect to sync
│  │      let items = $state(data.items);
│  │      $effect(() => { items = data.items; });
│  │
│  └─ Is it read-only? (display, filtering, sorting)
│      └─ YES → Use $derived
│           let items = $derived(data.items);
│
└─ NO (local state)
   ├─ Is it computed from other state?
   │  └─ YES → Use $derived
   │       const total = $derived(price * quantity);
   │
   └─ Is it temporary UI state?
       └─ YES → Use $state
            let isLoading = $state(false);
```

### Code Review Checklist

When reviewing components with reactive state:

- [ ] Arrays/objects from props use `$derived` if read-only
- [ ] Arrays/objects that need mutation use `$state` + `$effect` sync
- [ ] No direct mutations on `$derived` values (`.push()`, `[index] =`, etc.)
- [ ] Loading states use overlay pattern, not component replacement
- [ ] Optimistic updates have rollback on error
- [ ] After `invalidate()`, UI syncs with server state


## Testing

### Manual Test Steps

1. **Initial state**
   - Load courier dashboard
   - Verify services display with correct status badges

2. **Optimistic update**
   - Click status toggle button on a service
   - Verify status badge updates immediately (no page refresh)
   - Verify loading spinner appears briefly

3. **Server sync**
   - Wait for server response
   - Verify status remains updated (doesn't revert)
   - Refresh page manually
   - Verify status persisted in database

4. **Workload card stability**
   - Click status toggle
   - Verify workload card stays visible (doesn't unmount)
   - Verify loading spinner appears in workload card
   - Verify no vertical layout shift


## Related Issues

- [Form inputs losing values after submission](../form-handling/svelte5-form-inputs-losing-values-after-submission.md) - Similar `$state` vs `$derived` issue
- [Svelte 5 effect promise infinite loop](../runtime-errors/svelte-5-effect-promise-infinite-loop.md) - Related `$effect` anti-pattern

## References

- [Svelte 5 Runes: $state](https://svelte.dev/docs/svelte/$state)
- [Svelte 5 Runes: $derived](https://svelte.dev/docs/svelte/$derived)
- [Svelte 5 Runes: $effect](https://svelte.dev/docs/svelte/$effect)
- [Project: .claude/rules/svelte-form-state.md](.claude/rules/svelte-form-state.md)
- [Project: .claude/rules/code-style.md](.claude/rules/code-style.md)

## Commit

```
62158df - fix: resolve service status update and workload reload UI issues
```

**Changes:**
- Changed `services` from `$derived` to `$state` with `$effect` sync
- Added `loading` prop to `WorkloadCard` to prevent layout shift
- Maintains consistent UI height during reload with spinner overlay
