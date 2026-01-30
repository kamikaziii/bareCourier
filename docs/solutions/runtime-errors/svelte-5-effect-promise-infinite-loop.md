---
title: Browser Freeze from Infinite Reactivity Loop in Badge Promise Resolution
category: runtime-errors
component:
  - src/lib/components/MobileBottomNav.svelte
  - src/lib/components/SidebarItem.svelte
  - src/lib/components/MoreDrawer.svelte
tags:
  - svelte-5
  - effect
  - reactive
  - promises
  - infinite-loop
  - browser-freeze
  - state-management
  - async
  - navigation
  - debugging
  - performance
date: 2026-01-30
severity: critical
---

# Browser Freeze from Infinite Reactivity Loop in Badge Promise Resolution

## Problem Summary

Navigation components (MobileBottomNav, SidebarItem, MoreDrawer) caused **complete browser freezes** due to infinite reactivity loops when handling promise-based badge counts.

**Symptom**: Browser became completely unresponsive when loading dashboard or navigating between pages. DevTools could not be opened. Page required force-quit.

## Root Cause

The components used `$effect` blocks to resolve promise badges and stored results in `$state` Maps. This created an infinite loop:

1. `$effect` runs and reads `items` prop
2. For each promise badge, `.then()` handler updates the state Map
3. Map reassignment triggers reactivity: `resolvedBadges = new Map(resolvedBadges)`
4. State change causes `$effect` to re-run
5. **Infinite loop** → browser freeze

**Why this happens in Svelte 5**: The `$effect` rune automatically tracks **all reactive state read inside it**. When the effect updates that same state, Svelte schedules a re-run, creating an endless cycle.

## Investigation Steps

### What We Tried (That Didn't Work)

1. ❌ **Fixed LoadingBar component** - Suspected reactive loop in navigation bar
   - Result: Fixed a different issue, but freeze persisted

2. ❌ **Converted $effect to onMount in data-fetching components**
   - Fixed: WorkStatusBar, NotificationBell, Dashboard workload loading
   - Result: Freeze still occurred

3. ✅ **Disabled components one-by-one** - Binary search approach
   - Disabled: Sidebar, NotificationBell, WorkStatusBar
   - Result: Page loaded successfully
   - Re-enabled MobileBottomNav → **Freeze returned**
   - **Culprit identified**: MobileBottomNav component

4. ✅ **Found same pattern in 2 other components**
   - MoreDrawer.svelte
   - SidebarItem.svelte
   - All had identical `$effect` + promise + state update pattern

## The Anti-Pattern (Broken Code)

```svelte
<script lang="ts">
  import type { NavItem } from '$lib/types/navigation.js';

  let { mainItems }: { mainItems: NavItem[] } = $props();

  // ❌ State that will be updated inside effect
  let resolvedMainBadges = $state<Map<string, number>>(new Map());

  // ❌ INFINITE LOOP: Reads mainItems, updates resolvedMainBadges
  $effect(() => {
    mainItems.forEach(item => {
      if (item.badge === undefined) {
        resolvedMainBadges.set(item.href, 0);
      } else if (typeof item.badge === 'number') {
        resolvedMainBadges.set(item.href, item.badge);
      } else {
        // ❌ Promise .then() updates state INSIDE effect
        item.badge.then(value => {
          resolvedMainBadges.set(item.href, value);
          resolvedMainBadges = new Map(resolvedMainBadges); // ⚠️ Triggers effect!
        });
      }
    });
  });
</script>

{#each mainItems as item}
  {@const badgeCount = resolvedMainBadges.get(item.href) || 0}
  <!-- Render badge -->
{/each}
```

**Why this freezes**:
- `$effect` runs when `mainItems` changes
- Promise resolves → calls `.then()` → updates `resolvedMainBadges`
- Reassignment `resolvedMainBadges = new Map(...)` triggers reactivity
- `$effect` re-runs because it reads `mainItems` (still the same)
- Promise handlers from previous run are still pending
- Each run creates NEW promise handlers
- **Exponential growth** → browser freeze

## The Solution (Fixed Code)

Use Svelte 5's idiomatic `{#await}` blocks in the template:

```svelte
<script lang="ts">
  import type { NavItem } from '$lib/types/navigation.js';
  import { formatBadge } from '$lib/utils.js';

  let { mainItems }: { mainItems: NavItem[] } = $props();

  // ✅ NO state needed - promises handled declaratively
</script>

{#each mainItems as item}
  {@const Icon = item.icon}
  {@const active = isItemActive(item.href, currentPath)}

  <a href={item.href}>
    <Icon />
    {#if item.badge !== undefined}
      {#if typeof item.badge === 'number'}
        <!-- ✅ Synchronous badge: render immediately -->
        {@const displayBadge = formatBadge(item.badge, 9)}
        {#if displayBadge}
          <Badge>{displayBadge}</Badge>
        {/if}
      {:else}
        <!-- ✅ Async badge: use {#await} -->
        {#await item.badge then count}
          {@const displayBadge = formatBadge(count, 9)}
          {#if displayBadge}
            <Badge>{displayBadge}</Badge>
          {/if}
        {/await}
      {/if}
    {/if}
  </a>
{/each}
```

**Why this works**:
- No `$effect` blocks
- No manual promise resolution
- No state updates
- Svelte handles promise lifecycle automatically
- `{#await}` blocks re-render when promise resolves
- **No reactive loops possible**

## Files Modified

All three components fixed with same transformation:

### 1. MobileBottomNav.svelte
```diff
- let resolvedMainBadges = $state<Map<string, number>>(new Map());
- let resolvedMoreBadges = $state<Map<string, number>>(new Map());
-
- $effect(() => {
-   mainItems.forEach(item => {
-     // ... promise resolution logic
-   });
- });

+ {#if typeof item.badge === 'number'}
+   {@const displayBadge = formatBadge(item.badge, 9)}
+   <!-- render -->
+ {:else}
+   {#await item.badge then count}
+     {@const displayBadge = formatBadge(count, 9)}
+     <!-- render -->
+   {/await}
+ {/if}
```

### 2. MoreDrawer.svelte
```diff
- let resolvedBadges = $state<Map<string, number>>(new Map());
-
- $effect(() => {
-   items.forEach(item => {
-     // ... promise resolution
-   });
- });

+ {#await item.badge then count}
+   {@const displayBadge = formatBadge(count)}
+   <Badge>{displayBadge}</Badge>
+ {/await}
```

### 3. SidebarItem.svelte
```diff
- let badgeValue = $state<number | undefined>(undefined);
-
- $effect(() => {
-   if (typeof badge === 'number') {
-     badgeValue = badge;
-   } else if (badge) {
-     badge.then(value => { badgeValue = value; });
-   }
- });

+ {#await badge then count}
+   {@const displayBadge = formatBadge(count)}
+   <Badge>{displayBadge}</Badge>
+ {/await}
```

## Verification

After applying fixes:

1. ✅ **Browser loads normally** - No freeze on page load
2. ✅ **Navigation works smoothly** - No freeze when clicking links
3. ✅ **Promise badges display** - Async badge counts appear when resolved
4. ✅ **DevTools accessible** - Performance tab shows normal CPU usage
5. ✅ **All components re-enabled** - Sidebar, NotificationBell, WorkStatusBar all working

## Prevention Strategies

### Best Practices

1. **Default to `{#await}` for promises in templates**
   - Declarative, built-in loading states
   - No manual state management
   - No risk of infinite loops

2. **Never update `$state` inside `$effect` if effect reads that state**
   - Use `untrack()` if you must read without tracking
   - Or refactor to use `$derived` instead

3. **Use `onMount()` for one-time data fetching**
   - Not reactive, runs once
   - Safer than `$effect` for initialization

4. **Use server `load()` functions for data**
   - SSR-friendly
   - No client-side waterfalls
   - Already available in `$props()`

### Code Review Checklist

When reviewing `$effect` usage:

- [ ] Does effect read any state it also writes? → **Infinite loop risk**
- [ ] Does effect call a function that updates tracked state? → **Loop risk**
- [ ] Could this be `onMount()` instead? → **Safer**
- [ ] Could this be `$derived()` instead? → **Simpler**
- [ ] Are promises handled with `{#await}` in template? → **Idiomatic**
- [ ] Is there a cleanup function returned? → **Prevents memory leaks**

### Testing for Infinite Loops

**Manual test**:
```bash
1. Open DevTools → Performance tab
2. Click "Record"
3. Navigate to the page
4. Stop after 5 seconds
5. Look for flat flame graph (sign of infinite loop)
```

**Automated E2E test**:
```typescript
test('Navigation does not freeze browser', async ({ page }) => {
  page.setDefaultTimeout(5000); // Will fail if freezes

  await page.goto('/courier');
  await expect(page.locator('h1')).toBeVisible();

  // Navigate to trigger components
  await page.click('a[href="/courier/services"]');
  await expect(page).toHaveURL(/\/courier\/services/);

  // Should complete without timeout
});
```

## Related Documentation

- [Svelte 5 $effect Documentation](https://svelte.dev/docs/svelte/$effect)
- [Svelte 5 {#await} Blocks](https://svelte.dev/docs/svelte/await)
- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- Internal: `.claude/rules/code-style.md` - Svelte 5 patterns
- Internal: `docs/solutions/ui-bugs/svelte5-form-state-sync-after-submission.md`

## Related Issues

- **PR #8**: Navigation Performance Fixes (current branch)
- **Todo #122**: No cancellation token in NotificationBell effect
- **Todo #133**: Double route API call from effect + handler conflict
- **LoadingBar.svelte**: Fixed different infinite loop using `untrack()`

## Key Learnings

1. **`$effect` is for side effects, not data transformation**
   - Use `$derived` for calculations
   - Use `{#await}` for async data in templates

2. **Svelte 5 reactive model is "push-pull"**
   - Updates are immediate (push)
   - Re-computation is lazy (pull)
   - Effects run in microtasks
   - Writing to tracked state in effect = instant re-run

3. **Promises in Svelte 5 templates are first-class**
   - `{#await}` handles loading/error/success states
   - No manual state management needed
   - Cleaner code, fewer bugs

4. **Binary search debugging for freezes**
   - Disable half the components
   - Narrow down to specific component
   - Faster than reading all code

## Authors

- Fixed by: Claude Code debugging session
- Reviewed by: Developer verification
- Date: 2026-01-30
