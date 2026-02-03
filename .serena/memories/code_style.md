# bareCourier - Code Style & Conventions

## Svelte 5 (CRITICAL)
**Always use Svelte 5 runes syntax, never legacy Svelte 4 syntax.**

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();  // Props
  let count = $state(0);                         // Reactive state
  const doubled = $derived(count * 2);           // Derived values
  $effect(() => { /* side effects */ });         // Effects
</script>
<button onclick={handleClick}>                   <!-- Event handlers (not on:click) -->
{@render children()}                             <!-- Snippets (not <slot/>) -->
```

## $state vs $derived
- Use `$derived` for prop-based values (auto-syncs)
- Use `$state` only for local UI state or values that need mutation
- See `.claude/rules/svelte-form-state.md` for form patterns

## TypeScript
- Strict mode enabled
- Explicit return types for exported functions
- Type assertions after Supabase queries:
  ```typescript
  const { data } = await supabase.from('profiles').select('*').single();
  const profile = data as Profile | null;
  ```

## shadcn-svelte Imports
```typescript
import { Button } from '$lib/components/ui/button/index.js';
import * as Card from '$lib/components/ui/card/index.js';  // Multi-part
```

## File Naming
- Components: `PascalCase.svelte`
- Routes: `+page.svelte`, `+layout.svelte`, etc.
- Utilities: `kebab-case.ts`
- Types: `*.types.ts`

## Status Colors
- Pending: `bg-blue-500`
- Delivered: `bg-green-500`

## Import Order
1. Svelte/SvelteKit imports
2. External packages
3. Internal `$lib` imports (always with `.js` extension)
4. Relative imports
5. Type imports
