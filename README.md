# bareCourier

A simple PWA for a solo dental lab courier to manage pickups and deliveries, replacing paper-based tracking.

## Features

- **Courier Dashboard**: View today's services, quick filters (today/tomorrow/all), one-tap status toggle
- **Service Management**: Create, view, and update pickup/delivery jobs
- **Client Management**: Add and manage dental lab clients
- **Monthly Reports**: Filter by client/date/status, export to CSV
- **Client Portal**: Clients can view their services and create new requests
- **PWA Support**: Install on mobile devices for native-like experience

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [SvelteKit](https://kit.svelte.dev/) + Svelte 5 |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Components | [shadcn-svelte](https://shadcn-svelte.com/) |
| Backend | [Supabase](https://supabase.com/) (Auth + Postgres) |
| PWA | [@vite-pwa/sveltekit](https://vite-pwa-org.netlify.app/frameworks/sveltekit) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm
- [Supabase](https://supabase.com/) account

### Installation

```bash
# Clone the repository
git clone https://github.com/kamikaziii/bareCourier.git
cd bareCourier

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to `.env`:
   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Run the migration in Supabase SQL Editor (or use Supabase CLI):
   ```bash
   # Using Supabase CLI
   npx supabase db push
   ```
   Or copy the contents of `supabase/migrations/001_initial_schema.sql` into the SQL Editor.

### Development

```bash
# Start development server
pnpm run dev

# Type checking
pnpm run check

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## Project Structure

```
bareCourier/
├── src/
│   ├── lib/
│   │   ├── components/ui/     # shadcn-svelte components
│   │   ├── database.types.ts  # TypeScript types for Supabase
│   │   └── utils.ts           # Utility functions
│   ├── routes/
│   │   ├── login/             # Login page
│   │   ├── courier/           # Courier routes (protected)
│   │   │   ├── +page.svelte   # Dashboard
│   │   │   ├── services/      # Services management
│   │   │   ├── clients/       # Client management
│   │   │   └── reports/       # Monthly reports
│   │   └── client/            # Client routes (protected)
│   │       ├── +page.svelte   # Client dashboard
│   │       └── new/           # New service request
│   ├── hooks.server.ts        # Supabase SSR auth
│   ├── app.css                # Tailwind CSS configuration
│   └── app.html               # HTML template
├── static/                    # Static assets
├── supabase/
│   └── migrations/            # Database migrations
├── docs/
│   └── IMPLEMENTATION_PLAN.md # Project roadmap
└── .claude/
    ├── CLAUDE.md              # AI assistant context
    └── rules/                 # Detailed conventions
```

## User Roles

### Courier (Admin)
- View and manage all services
- Create and manage client accounts
- Toggle service status (pending → delivered)
- Generate reports and export CSV

### Client (Dental Lab)
- View their own services
- Create new pickup/delivery requests
- Pre-filled pickup location from profile

## Database Schema

### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (from auth.users) |
| role | text | 'courier' or 'client' |
| name | text | Display name |
| phone | text | Contact number |
| default_pickup_location | text | Client's lab address |
| active | boolean | Account status |
| created_at | timestamptz | Creation timestamp |

### services
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| client_id | uuid | Reference to profiles |
| pickup_location | text | Pickup address |
| delivery_location | text | Delivery address |
| status | text | 'pending' or 'delivered' |
| notes | text | Optional notes |
| created_at | timestamptz | Creation timestamp |
| delivered_at | timestamptz | Delivery timestamp |

## Creating the First Courier Account

Since the courier is the admin who creates client accounts, you need to manually create the first courier user:

1. Go to your Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. After creation, go to SQL Editor and run:
   ```sql
   UPDATE public.profiles
   SET role = 'courier'
   WHERE id = 'user-uuid-from-auth';
   ```

Or use the Auth API with metadata:
```typescript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'courier@example.com',
  password: 'secure-password',
  user_metadata: { name: 'Courier Name', role: 'courier' }
});
```

## Status Indicators

| Status | Color | Meaning |
|--------|-------|---------|
| Pending | Blue | Awaiting pickup/delivery |
| Delivered | Green | Service completed |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/)
3. Add environment variables:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

The project uses `@sveltejs/adapter-vercel` and will automatically configure for Vercel.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feat/my-feature`
5. Open a Pull Request

## AI Assistant Integration

This project includes comprehensive documentation for AI coding assistants:

- `.claude/CLAUDE.md` - Project context and quick reference
- `.claude/rules/` - Detailed conventions for architecture, code style, and database

When using Claude Code or similar AI assistants, these files provide project-specific context for better code generation.

## License

MIT

---

Built with [SvelteKit](https://kit.svelte.dev/), [Supabase](https://supabase.com/), and [shadcn-svelte](https://shadcn-svelte.com/).
