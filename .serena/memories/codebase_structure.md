# bareCourier - Codebase Structure

## Root Files
```
package.json          # pnpm scripts and dependencies
svelte.config.js      # SvelteKit configuration
vite.config.ts        # Vite configuration (Tailwind v4, PWA)
tsconfig.json         # TypeScript strict mode
.prettierrc           # Code formatting (Svelte plugin)
CLAUDE.md             # AI assistant instructions
```

## Source Directory (`src/`)
```
src/
├── app.css           # Tailwind v4 theme (OKLCH colors)
├── app.html          # PWA meta tags, splash screen links
├── app.d.ts          # App-level TypeScript declarations
├── hooks.server.ts   # Supabase SSR auth per request
├── hooks.ts          # Client hooks
├── service-worker.ts # Custom SW with Supabase caching
├── lib/              # Shared library code
├── routes/           # SvelteKit routes
└── paraglide/        # i18n generated files
```

## Library (`src/lib/`)
```
src/lib/
├── components/       # Reusable components
│   └── ui/           # shadcn-svelte components
├── services/         # External API services
│   ├── distance.ts   # OpenRouteService + Haversine
│   └── geocoding.ts  # Mapbox address search
├── stores/           # Svelte stores
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── constants/        # App constants
├── composables/      # Reusable logic (hooks-like)
├── database.types.ts # Supabase types (manual)
└── database.generated.ts  # Supabase types (generated)
```

## Routes (`src/routes/`)
```
src/routes/
├── +layout.svelte    # Root layout (CSS, auth subscription)
├── +layout.ts        # Supabase client creation
├── +layout.server.ts # Session validation with safeGetSession()
├── +page.svelte      # Root redirect based on role
├── login/            # Public login page
├── forgot-password/  # Password reset request
├── reset-password/   # Password reset form
├── courier/          # Courier-only routes (auth guarded)
│   ├── +layout.server.ts  # Auth guard (role: courier)
│   ├── services/     # Service management
│   ├── clients/      # Client management
│   ├── settings/     # Courier settings
│   └── reports/      # Monthly reports
├── client/           # Client-only routes (auth guarded)
│   ├── +layout.server.ts  # Auth guard (role: client)
│   ├── services/     # Client's services
│   ├── new/          # Create service request
│   └── settings/     # Client settings
├── track/            # Public service tracking
└── api/              # API endpoints
```

## Database (`supabase/`)
```
supabase/
├── config.toml       # Supabase configuration
├── migrations/       # SQL migrations (versioned)
└── functions/        # Edge functions (if any)
```

## Custom Components
Key custom components in `src/lib/components/`:
- `AddressInput.svelte` - Mapbox geocoding autocomplete
- `RouteMap.svelte` - Mapbox map with route display
- `SchedulePicker.svelte` - Date + time slot picker
- `NotificationBell.svelte` - Real-time notification dropdown
