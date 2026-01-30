# Svelte 5 $effect Best Practices & Prevention Guide

> **TL;DR**: Use `{#await}` for promises, `$derived` for calculations, `onMount()` for initialization. Only use `$effect` for external systems (DOM, timers, listeners) and **never** update state that the effect reads.

## Quick Decision Tree

```
Need to run code?
├─ On mount only?
│  └─ Use onMount()
├─ On prop change?
│  ├─ Just compute value?
│  │  └─ Use $derived()
│  └─ Side effect needed?
│     ├─ External system (DOM, timer, listener)?
│     │  └─ Use $effect() with cleanup
│     └─ Data fetch?
│        └─ Use server load function or {#await}
└─ Never automatically?
   └─ Use regular function, call manually
```

## The Golden Rules

1. ✅ **Default to `onMount()`** for one-time initialization
2. ✅ **Use `$derived()`** for calculations
3. ✅ **Use `$effect()`** only for external systems (DOM, timers, listeners)
4. ✅ **Always return cleanup** from `$effect()`
5. ❌ **Never mutate state** that the effect reads (or use `untrack()`)
6. ❌ **Avoid data fetching** in `$effect()` - use server loads instead
7. ✅ **Test navigation thoroughly** when using `$effect()` with navigation state

## Common Patterns: Safe vs Unsafe

### ❌ ANTI-PATTERN 1: Async Data Fetching in Effect

```svelte
<script>
  let data = $state([]);
  let loading = $state(false);

  // ❌ WRONG: If `data` changes, effect re-runs, fetches again
  $effect(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    const result = await fetch('/api/data');
    data = await result.json(); // Updates data → triggers effect again!
    loading = false;
  }
</script>
```

**✅ FIX: Use onMount**

```svelte
<script>
  import { onMount } from 'svelte';

  let data = $state([]);
  let loading = $state(false);

  onMount(() => {
    loadData(); // Runs once
  });

  async function loadData() {
    loading = true;
    const result = await fetch('/api/data');
    data = await result.json();
    loading = false;
  }
</script>
```

### ❌ ANTI-PATTERN 2: Promise Resolution in Effect

```svelte
<script>
  let { items } = $props(); // items: { badge: Promise<number> }[]
  let badges = $state(new Map());

  // ❌ INFINITE LOOP
  $effect(() => {
    items.forEach(item => {
      item.badge.then(value => {
        badges.set(item.id, value);
        badges = new Map(badges); // Triggers re-run!
      });
    });
  });
</script>
```

**✅ FIX: Use {#await} in template**

```svelte
<script>
  let { items } = $props();
</script>

{#each items as item}
  {#await item.badge then count}
    <Badge>{count}</Badge>
  {/await}
{/each}
```

### ❌ ANTI-PATTERN 3: Reading and Writing Same State

```svelte
<script>
  let items = $state([]);

  // ❌ INFINITE LOOP
  $effect(() => {
    if (items.length > 0) {
      items = items.slice(0, 10); // Modifies items → re-runs effect!
    }
  });
</script>
```

**✅ FIX: Use $derived**

```svelte
<script>
  let items = $state([]);
  let limitedItems = $derived(items.slice(0, 10)); // Pure computation
</script>
```

### ✅ SAFE PATTERN: External System Integration

```svelte
<script>
  let { color, size } = $props();
  let canvas;

  // ✅ SAFE: Reads props, writes to DOM (not tracked state)
  $effect(() => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color; // Read prop
    ctx.fillRect(0, 0, size, size); // Write to DOM

    // No state updates, no loop
  });
</script>

<canvas bind:this={canvas} width="100" height="100"></canvas>
```

### ✅ SAFE PATTERN: Timer with Proper Cleanup

```svelte
<script>
  let elapsed = $state(0);
  let running = $state(false);

  // ✅ SAFE: Only reads `running`, only writes `elapsed`
  $effect(() => {
    if (!running) return;

    const start = Date.now();
    const interval = setInterval(() => {
      elapsed = Date.now() - start;
    }, 100);

    return () => clearInterval(interval);
  });
</script>
```

### ⚠️ NEEDS UNTRACK: Reading State for Conditional Write

```svelte
<script>
  import { untrack } from 'svelte';

  let isVisible = $state(false);
  let { navigating } = $props();

  // ⚠️ Without untrack, this would loop
  $effect(() => {
    if (navigating) {
      isVisible = true;
    } else if (untrack(() => isVisible)) { // ✅ Read without tracking
      setTimeout(() => {
        isVisible = false;
      }, 200);
    }
  });
</script>
```

## State Mutation Safety Matrix

| Effect Reads | Effect Writes | Result | Fix |
|--------------|---------------|--------|-----|
| `stateA` | `stateA` | ❌ Infinite loop | Use `$derived` or `untrack()` |
| `stateA` | `stateB` | ✅ Safe | - |
| `untrack(() => stateA)` | `stateA` | ✅ Safe | - |
| `propA` | `stateB` | ✅ Safe | - |
| Nothing (event listener) | `stateA` | ✅ Safe | - |
| `propA` | DOM/external | ✅ Safe | - |

## Code Review Checklist

When reviewing `$effect` usage:

- [ ] **Dependencies clear**: Can you identify all state the effect depends on?
- [ ] **No circular updates**: Does the effect write to state it reads?
- [ ] **Proper cleanup**: Does the effect return a cleanup function for timers/listeners?
- [ ] **Not for data fetching**: Could this be `onMount()` or a server load function instead?
- [ ] **Untrack used correctly**: Are `untrack()` calls justified and documented?
- [ ] **No async $effect**: Is there an `async` keyword directly on `$effect(() => {})`? (Not allowed)
- [ ] **Error handling**: Are promise rejections caught?

## Testing for Infinite Loops

### Manual Performance Test

```bash
1. Open DevTools → Performance tab
2. Click Record
3. Navigate to the page with the component
4. Stop after 5 seconds
5. Look for:
   - Flat flame graph (infinite loop)
   - Spiky flame graph (normal)
```

### Automated E2E Test

```typescript
// tests/navigation.spec.ts
import { test, expect } from '@playwright/test';

test('Component does not cause infinite loop', async ({ page }) => {
  // Will timeout if page freezes
  page.setDefaultTimeout(5000);

  await page.goto('/dashboard');
  await expect(page.locator('h1')).toBeVisible();

  // Navigate to trigger effects
  await page.click('a[href="/services"]');
  await expect(page).toHaveURL(/\/services/);
});
```

## When to Use What

| Use Case | Tool | Example |
|----------|------|---------|
| One-time initialization | `onMount()` | Event listener setup, initial data load |
| Compute from props | `$derived()` | `const doubled = $derived(count * 2)` |
| Sync with external system | `$effect()` | Canvas drawing, DOM manipulation |
| Handle async data | `{#await}` | `{#await promise then data}` |
| Server data fetching | `+page.server.ts` | `export const load = async () => {}` |
| Event handler | Regular function | `onclick={handleClick}` |

## Real-World Example: LoadingBar

```svelte
<script lang="ts">
  import { navigating } from '$app/state';
  import { untrack } from 'svelte';

  let progress = $state(0);
  let isVisible = $state(false);
  let animationFrame: number | undefined;

  $effect(() => {
    const isNavigating = !!(navigating && navigating.to);

    if (isNavigating) {
      isVisible = true;
      progress = 0;

      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        progress = Math.min((elapsed / 500) * 90, 90);

        if (progress < 90) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);
    } else {
      // ✅ CRITICAL: Use untrack() to avoid dependency
      if (untrack(() => isVisible)) {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }

        progress = 100;
        setTimeout(() => {
          isVisible = false;
          progress = 0;
        }, 200);
      }
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  });
</script>

<div class:visible={isVisible} style="width: {progress}%"></div>
```

**Why this works**:
- Effect only tracks `navigating` prop
- `isVisible` read with `untrack()` doesn't create dependency
- No circular state updates
- Proper cleanup prevents memory leaks

## Summary

### Do ✅
- Use `{#await}` for promises in templates
- Use `$derived` for calculations
- Use `onMount()` for one-time setup
- Return cleanup functions from `$effect`
- Use `untrack()` when needed (and document why)

### Don't ❌
- Don't fetch data in `$effect`
- Don't update state that the effect reads
- Don't use `async` directly on `$effect`
- Don't forget cleanup functions
- Don't use `$effect` when `$derived` would work

### When in Doubt
Ask yourself: "Does this need to re-run on every state change?"
- **No** → Use `onMount()` or regular function
- **Yes, to compute a value** → Use `$derived()`
- **Yes, to sync with external system** → Use `$effect()` carefully

## Further Reading

- [Official Svelte 5 $effect Documentation](https://svelte.dev/docs/svelte/$effect)
- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- Internal: `.claude/rules/code-style.md`
- Internal: `docs/solutions/runtime-errors/svelte-5-effect-promise-infinite-loop.md`
