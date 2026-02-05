---
paths:
  - "src/**/*.ts"
  - "src/**/*.svelte"
---

# Code Style Rules

## TypeScript

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
const name = profile?.name || 'Unknown';  // Optional chaining
const count = value ?? 0;                  // Nullish coalescing
```

## Svelte 5 State

### $state vs $derived (CRITICAL)
```svelte
<!-- Props = $derived (syncs automatically) -->
let { formData } = $props();
let email = $derived(formData.email);      // ✅ Syncs with prop
let isLoading = $state(false);             // ✅ Local UI state

<!-- WRONG: $state from props doesn't sync -->
let email = $state(formData.email);        // ❌ Stale data bug!

<!-- WRONG: Mutating $derived arrays -->
let items = $derived(data.items);
items.push(newItem);                       // ❌ Won't trigger reactivity!

<!-- CORRECT: Local state with reassignment -->
let items = $state<Item[]>([]);
items = [...items, newItem];               // ✅ Works
```

### Editable Forms Pattern
```svelte
// svelte-ignore state_referenced_locally
let name = $state(profile.name);
$effect(() => { name = profile.name; });   // Sync after invalidateAll()
```

## Tailwind CSS v4

### Theme Colors
```html
<div class="bg-background text-foreground">
<div class="bg-primary text-primary-foreground">
<div class="bg-destructive text-destructive-foreground">

<!-- Status (project-specific) -->
<div class="bg-blue-500">Pending</div>
<div class="bg-green-500">Delivered</div>
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `ServiceCard.svelte` |
| Functions/Variables | camelCase | `loadServices`, `isLoading` |
| Constants | SCREAMING_SNAKE | `MAX_ITEMS` |
| Types/Interfaces | PascalCase | `Profile`, `Service` |
| Files (non-component) | kebab-case | `database.types.ts` |

## Error Handling

```typescript
const { data, error } = await supabase.from('table').select('*');
if (error) {
  errorMessage = error.message;
  return;
}
items = data || [];
```
