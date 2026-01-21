# bareCourier - Project Context

## Overview

bareCourier is a PWA for a solo courier to manage pickups and deliveries, replacing paper-based tracking. Simple, mobile-first, two user roles: **courier** (admin) and **client** (businesses).

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | SvelteKit | 2.50+ |
| Language | Svelte 5 | 5.47+ (runes syntax) |
| Styling | Tailwind CSS | v4 with `@tailwindcss/vite` |
| Components | shadcn-svelte | 1.1+ (new-york style) |
| Backend | Supabase | Auth + Postgres + RLS |
| PWA | @vite-pwa/sveltekit | 1.1+ |
| Deployment | Vercel | adapter-vercel |

## Quick Commands

```bash
pnpm run dev              # Start dev server (localhost:5173)
pnpm run build            # Production build
pnpm run check            # TypeScript + Svelte check
pnpm run preview          # Preview production build
pnpm run generate-pwa-assets  # Regenerate PWA icons/splash screens
```

## Project Structure

```
src/
├── lib/
│   ├── components/ui/     # shadcn-svelte components
│   ├── database.types.ts  # Supabase TypeScript types
│   └── utils.ts           # cn() helper + type utilities
├── routes/
│   ├── login/             # Public login page
│   ├── courier/           # Courier-only routes (auth guarded)
│   │   ├── +page.svelte   # Dashboard
│   │   ├── services/      # Services list + create
│   │   ├── clients/       # Client management
│   │   └── reports/       # Monthly reports + CSV export
│   └── client/            # Client-only routes (auth guarded)
│       ├── +page.svelte   # Client dashboard
│       └── new/           # Create service request
├── service-worker.ts      # Custom SW with Supabase caching
├── hooks.server.ts        # Supabase SSR auth
├── app.html               # PWA meta tags + splash screen links
└── app.css                # Tailwind v4 theme (OKLCH colors)
static/
├── manifest.webmanifest   # PWA manifest with shortcuts
├── favicon.ico            # Multi-resolution favicon
├── pwa-*.png              # PWA icons (64, 192, 512)
├── maskable-icon-512x512.png
├── apple-touch-icon-180x180.png
└── images/                # Splash screens + logo source
```

## Architecture Rules

See @.claude/rules/architecture.md for detailed patterns.

## Code Style

See @.claude/rules/code-style.md for conventions.

## Database

See @.claude/rules/database.md for schema and RLS policies.

## Key Patterns

### Svelte 5 Runes (REQUIRED)
```svelte
<script lang="ts">
  let count = $state(0);           // Reactive state
  const doubled = $derived(count * 2);  // Derived value

  $effect(() => {                  // Side effects
    console.log(count);
  });

  let { data }: { data: PageData } = $props();  // Props
</script>
```

### Supabase Client Access
- Server: `locals.supabase` in `+page.server.ts` / `+layout.server.ts`
- Client: `data.supabase` from layout load function
- Always use `safeGetSession()` on server for JWT validation

### Auth Guards
- Courier routes: `src/routes/courier/+layout.server.ts`
- Client routes: `src/routes/client/+layout.server.ts`
- Both redirect to `/login` if unauthenticated

### Status Indicators
- **Pending**: Blue (`bg-blue-500`)
- **Delivered**: Green (`bg-green-500`)

## Common Tasks

### Add a shadcn-svelte component
```bash
pnpm dlx shadcn-svelte@latest add [component] --yes
```

### Create new route
1. Create `src/routes/[path]/+page.svelte`
2. Create `src/routes/[path]/+page.ts` for data loading
3. If protected, ensure parent layout has auth guard

### Database changes
1. Update `supabase/migrations/` with new SQL
2. Apply via Supabase MCP: `mcp__supabase__apply_migration`
3. Update `src/lib/database.types.ts`

## Environment Variables

```
PUBLIC_SUPABASE_URL=https://[project].supabase.co
PUBLIC_SUPABASE_ANON_KEY=[anon-key]
```

## Testing Checklist

1. Auth: Login as courier, login as client, verify redirects
2. Services: Create → pending (blue) → delivered (green)
3. Data isolation: Client A cannot see Client B's services
4. PWA: Test "Add to Home Screen" on mobile
5. Reports: Filter + export CSV

## Implementation Status

See @docs/IMPLEMENTATION_PLAN.md for current progress.

---

**Repository**: https://github.com/kamikaziii/bareCourier
