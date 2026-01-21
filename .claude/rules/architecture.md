# Architecture Rules

## Component Architecture

### Route Structure
```
src/routes/
├── +layout.svelte      # Root: imports CSS, handles auth subscription
├── +layout.ts          # Root: creates Supabase client
├── +layout.server.ts   # Root: safe session handling
├── +page.svelte        # Redirect based on role
├── login/              # Public
├── courier/            # Protected (role: courier)
│   └── +layout.server.ts  # Auth guard
└── client/             # Protected (role: client)
    └── +layout.server.ts  # Auth guard
```

### Data Flow
1. `hooks.server.ts` creates Supabase client per request
2. `+layout.server.ts` validates session with `safeGetSession()`
3. `+layout.ts` creates browser/server client based on environment
4. Components access `data.supabase` for queries

### Auth Guard Pattern
```typescript
// src/routes/[role]/+layout.server.ts
export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
  const { session, user } = await safeGetSession();

  if (!session || !user) {
    redirect(303, '/login');
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (!profile || profile.role !== 'expected_role') {
    redirect(303, '/other_role');
  }

  return { profile };
};
```

## Component Patterns

### Page Component Structure
```svelte
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // State
  let items = $state<Item[]>([]);
  let loading = $state(true);

  // Derived
  const filteredItems = $derived(items.filter(/* ... */));

  // Effects
  $effect(() => {
    loadItems();
  });

  // Functions
  async function loadItems() {
    loading = true;
    const { data: result } = await data.supabase
      .from('table')
      .select('*');
    items = result || [];
    loading = false;
  }
</script>

<!-- Template -->
```

### Form Handling Pattern
```svelte
<script lang="ts">
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = '';

    const { error: err } = await data.supabase
      .from('table')
      .insert({ /* data */ });

    if (err) {
      error = err.message;
      loading = false;
      return;
    }

    goto('/success');
  }
</script>

<form onsubmit={handleSubmit}>
  {#if error}
    <div class="text-destructive">{error}</div>
  {/if}
  <!-- fields -->
  <Button disabled={loading}>
    {loading ? 'Saving...' : 'Save'}
  </Button>
</form>
```

## File Naming

- Components: `PascalCase.svelte`
- Routes: `+page.svelte`, `+layout.svelte`, `+page.ts`, etc.
- Utilities: `kebab-case.ts`
- Types: `*.types.ts`

## Import Conventions

```typescript
// External packages first
import { goto } from '$app/navigation';
import { onMount } from 'svelte';

// Then internal aliases
import { Button } from '$lib/components/ui/button/index.js';
import type { PageData } from './$types';

// Always use .js extension for $lib imports (ESM requirement)
```
