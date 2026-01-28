# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bareCourier is a PWA for a solo courier to manage pickups/deliveries. Two user roles: **courier** (admin) and **client** (businesses).

**Tech Stack**: SvelteKit 2.50+ | Svelte 5 (runes) | Tailwind CSS v4 | shadcn-svelte | Supabase | Vercel

## Commands

```bash
pnpm run dev              # Dev server at localhost:5173
pnpm run build            # Production build
pnpm run check            # TypeScript + Svelte check
pnpm run preview          # Preview production build
pnpm run generate-pwa-assets  # Regenerate PWA icons/splash screens
```

```bash
# Add shadcn-svelte component
pnpm dlx shadcn-svelte@latest add [component] --yes
```

## Architecture

### Data Flow
1. `hooks.server.ts` creates Supabase client per request
2. `+layout.server.ts` validates session with `safeGetSession()`
3. `+layout.ts` creates browser/server client based on environment
4. Components access `data.supabase` for queries

### Route Protection
- `/courier/*` guarded by `src/routes/courier/+layout.server.ts` (role: courier)
- `/client/*` guarded by `src/routes/client/+layout.server.ts` (role: client)
- Both redirect to `/login` if unauthenticated or wrong role

### Database Tables
- `profiles`: id, role ('courier'|'client'), name, phone, default_pickup_location, active
- `services`: id, client_id, pickup_location, delivery_location, status ('pending'|'delivered'), notes, created_at, delivered_at

Types in `src/lib/database.types.ts`. RLS enforces courier sees all, clients see only their own.

## Code Patterns

### Svelte 5 Runes (REQUIRED)
```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();  // Props
  let count = $state(0);                         // State
  const doubled = $derived(count * 2);           // Derived
  $effect(() => { /* side effects */ });         // Effects
</script>
<button onclick={handleClick}>                   <!-- Event handlers -->
{@render children()}                             <!-- Snippets (not <slot/>) -->
```

### Supabase Queries
```typescript
// Server: use locals.supabase
// Client: use data.supabase from layout

// Type-safe query pattern
const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
const profile = data as Profile | null;

// Services with client info
const { data } = await supabase
  .from('services')
  .select('*, profiles!client_id(id, name)')
  .order('created_at', { ascending: false });
```

### shadcn-svelte Imports
```typescript
import { Button } from '$lib/components/ui/button/index.js';
import * as Card from '$lib/components/ui/card/index.js';  // Multi-part components
```

### Status Colors
- Pending: `bg-blue-500`
- Delivered: `bg-green-500`

### Custom Components (`src/lib/components/`)
- `AddressInput.svelte` - Mapbox geocoding autocomplete (debounced)
- `RouteMap.svelte` - Mapbox map with pickup/delivery route display
- `SchedulePicker.svelte` - Date picker + time slot selector
- `NotificationBell.svelte` - Real-time notification dropdown (Supabase subscription)

### External Services (`src/lib/services/`)
- `distance.ts` - OpenRouteService API + Haversine fallback
- `geocoding.ts` - Mapbox address search
- Requires: `PUBLIC_MAPBOX_TOKEN`, `PUBLIC_OPENROUTE_API_KEY`

## Database Changes

1. Create `supabase/migrations/NNN_description.sql`
2. Apply: `supabase db push`
3. Update `src/lib/database.types.ts`
4. Check security: `supabase inspect db lint`

## Environment Variables

```
PUBLIC_SUPABASE_URL=https://[project].supabase.co
PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

## Todo Tracking

File-based system in `todos/` directory:
- Format: `{id}-{status}-{priority}-{description}.md`
- Status: `pending` → `ready` → `complete`
- Priority: `p1` (critical), `p2` (important), `p3` (nice-to-have)
- Workflow: `/triage` to approve, `/resolve_todo_parallel` to implement
