# Code Style Rules

## TypeScript

### General
- Use TypeScript strict mode
- Prefer `const` over `let` when value won't change
- Use explicit return types for exported functions
- Use `type` for object shapes, `interface` for extendable contracts

### Type Assertions
```typescript
// Prefer: Type assertion after Supabase queries
const { data } = await supabase.from('profiles').select('*').single();
const profile = data as Profile | null;

// Avoid: Inline assertions in conditionals
if ((data as Profile).role === 'courier') // Hard to read
```

### Null Handling
```typescript
// Use optional chaining
const name = profile?.name || 'Unknown';

// Use nullish coalescing
const count = value ?? 0;
```

## Svelte 5

### Runes (REQUIRED - no legacy syntax)
```svelte
<!-- CORRECT: Svelte 5 runes -->
<script lang="ts">
  let count = $state(0);
  const doubled = $derived(count * 2);
  let { data } = $props();
</script>

<!-- WRONG: Legacy Svelte 4 syntax -->
<script lang="ts">
  let count = 0;           // Not reactive
  $: doubled = count * 2;  // Legacy
  export let data;         // Legacy
</script>
```

### Form State Management
**CRITICAL**: Use `$derived` for form values that come from props, NOT `$state`. This ensures form data syncs when props change.

```svelte
<!-- CORRECT: Props become $derived -->
<script lang="ts">
  let { formData }: { formData: FormData } = $props();

  let email = $derived(formData.email);      // Syncs with prop
  let phone = $derived(formData.phone);      // Syncs with prop
  let isLoading = $state(false);             // Local UI state
</script>

<!-- WRONG: Local $state loses sync -->
<script lang="ts">
  let { formData }: { formData: FormData } = $props();

  let email = $state(formData.email);        // Doesn't sync!
  let phone = $state(formData.phone);        // Doesn't sync!
</script>
```

See [svelte-form-state.md](./svelte-form-state.md) for detailed patterns and testing strategies.

### Event Handlers
```svelte
<!-- CORRECT: Svelte 5 -->
<button onclick={handleClick}>Click</button>
<form onsubmit={handleSubmit}>

<!-- WRONG: Legacy -->
<button on:click={handleClick}>
<form on:submit|preventDefault={handleSubmit}>
```

### Snippets (for slots)
```svelte
<!-- CORRECT: Svelte 5 snippets -->
{@render children()}

<!-- WRONG: Legacy slots -->
<slot />
```

## Tailwind CSS v4

### Theme Usage
```html
<!-- Use semantic color tokens -->
<div class="bg-background text-foreground">
<div class="bg-primary text-primary-foreground">
<div class="bg-muted text-muted-foreground">
<div class="bg-destructive text-destructive-foreground">

<!-- Status colors (project-specific) -->
<div class="bg-blue-500">Pending</div>
<div class="bg-green-500">Delivered</div>
```

### Spacing
```html
<!-- Use Tailwind spacing scale -->
<div class="p-4 space-y-6">
<div class="gap-2 mt-4">

<!-- Use size-* for equal width/height -->
<div class="size-4">  <!-- Instead of w-4 h-4 -->
```

### Responsive
```html
<!-- Mobile-first approach -->
<div class="grid gap-4 md:grid-cols-2">
<div class="text-sm md:text-base">
```

## shadcn-svelte Components

### Import Pattern
```typescript
// Named imports from index
import { Button } from '$lib/components/ui/button/index.js';
import { Input } from '$lib/components/ui/input/index.js';

// Namespace import for multi-part components
import * as Card from '$lib/components/ui/card/index.js';
```

### Component Usage
```svelte
<!-- Button variants -->
<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Tertiary</Button>
<Button variant="destructive">Danger</Button>

<!-- Card structure -->
<Card.Root>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Content>Content</Card.Content>
  <Card.Footer>Footer</Card.Footer>
</Card.Root>
```

## Formatting

### Indentation
- 1 tab for indentation (Svelte/TypeScript)
- Configure via `.prettierrc` or editor settings

### Line Length
- Soft limit: 100 characters
- Hard limit: 120 characters

### Imports Order
1. Svelte/SvelteKit imports
2. External packages
3. Internal `$lib` imports
4. Relative imports
5. Type imports (can be grouped with their module)

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ServiceCard.svelte` |
| Functions | camelCase | `loadServices()` |
| Variables | camelCase | `isLoading` |
| Constants | SCREAMING_SNAKE | `MAX_ITEMS` |
| Types/Interfaces | PascalCase | `Profile`, `Service` |
| CSS classes | kebab-case | `service-card` |
| Files (non-component) | kebab-case | `database.types.ts` |
| Routes | kebab-case | `/courier/clients` |

## Comments

```typescript
// Single line for brief explanations

/**
 * Multi-line for complex functions.
 * Explain the "why", not the "what".
 */

// TODO: Brief description of what needs to be done
// FIXME: Description of bug to fix
```

## Error Handling

```typescript
// Pattern for Supabase operations
const { data, error } = await supabase.from('table').select('*');

if (error) {
  // Set user-visible error state
  errorMessage = error.message;
  return;
}

// Process data
items = data || [];
```
