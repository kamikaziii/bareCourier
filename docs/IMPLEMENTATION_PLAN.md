# bareCourier - Implementation Plan

## Overview

A simple PWA for a solo dental lab courier to manage pickups/deliveries and replace paper tracking.

---

## Status

- [x] Phase 0: Project Initialization
- [x] Phase 1: Project Setup
- [ ] Phase 2: Authentication & Database
- [ ] Phase 3: Courier Features
- [ ] Phase 4: Client Features
- [ ] Phase 5: PWA & Polish
- [ ] Phase 6: Deployment

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | SvelteKit + Svelte 5 | Simple, fast, great PWA support |
| UI | shadcn-svelte + Tailwind v4 | Professional components, you own the code |
| Backend | Supabase | Auth + Postgres + real-time, generous free tier |
| PWA | @vite-pwa/sveltekit | Zero-config PWA plugin |
| Deployment | Vercel | Free tier, excellent SvelteKit adapter |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Vercel                        │
│  ┌───────────────────────────────────────────┐  │
│  │            SvelteKit PWA                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌───────────┐ │  │
│  │  │ Courier │  │ Client  │  │  Shared   │ │  │
│  │  │  Views  │  │  Views  │  │Components │ │  │
│  │  └─────────┘  └─────────┘  └───────────┘ │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│                  Supabase                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   Auth   │  │ Postgres │  │  Row Level   │  │
│  │          │  │    DB    │  │   Security   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────┘
```

## Database Schema

### Tables

```sql
-- Profiles (extends Supabase auth.users)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  role text NOT NULL CHECK (role IN ('courier', 'client')),
  name text NOT NULL,
  phone text,
  default_pickup_location text,  -- Client's lab address (auto-fill)
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Services (pickup/delivery jobs)
services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles NOT NULL,
  pickup_location text NOT NULL,
  delivery_location text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered')),
  notes text,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz
)
```

### Row Level Security (RLS)

- **Courier**: Can read/update all data, create clients
- **Clients**: Can only read/create their own services

## Project Structure

```
bareCourier/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn-svelte components
│   │   │   ├── ServiceCard.svelte
│   │   │   ├── ServiceForm.svelte
│   │   │   ├── StatusBadge.svelte
│   │   │   └── ClientSelector.svelte
│   │   ├── supabase.ts          # Supabase client
│   │   └── stores/
│   │       └── auth.ts          # Auth state store
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout with nav
│   │   ├── +page.svelte         # Landing/redirect
│   │   ├── login/
│   │   │   └── +page.svelte     # Login form
│   │   ├── courier/             # Courier-only routes
│   │   │   ├── +layout.svelte   # Auth guard
│   │   │   ├── +page.svelte     # Dashboard (today's services)
│   │   │   ├── services/
│   │   │   │   └── +page.svelte # All services list
│   │   │   ├── clients/
│   │   │   │   ├── +page.svelte # Client management
│   │   │   │   └── [id]/
│   │   │   │       └── +page.svelte # Client detail
│   │   │   └── reports/
│   │   │       └── +page.svelte # Monthly overview
│   │   └── client/              # Client-only routes
│   │       ├── +layout.svelte   # Auth guard
│   │       ├── +page.svelte     # Client dashboard
│   │       └── new/
│   │           └── +page.svelte # Create service form
│   ├── app.html
│   └── service-worker.ts
├── static/
│   ├── manifest.json
│   └── icons/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Implementation Phases

### Phase 0: Project Initialization
- [x] Write implementation plan to `/docs/IMPLEMENTATION_PLAN.md`
- [x] Create project folder structure
- [x] Initialize git repository with proper `.gitignore`
- [x] Push to GitHub as `bareCourier`
- [x] Create GitHub issue with full implementation plan

### Phase 1: Project Setup
- [x] Create SvelteKit project with Svelte 5
- [x] Configure Tailwind v4 + shadcn-svelte
- [x] Set up @vite-pwa/sveltekit
- [x] Create Supabase client and configure env vars
- [x] Configure Vercel adapter

### Phase 2: Authentication & Database
- [x] Create database schema (profiles, services tables)
- [x] Configure Row Level Security policies
- [ ] Implement login page
- [ ] Create auth store and guards
- [ ] Build profile creation for courier to add clients

### Phase 3: Courier Features
- [ ] **Dashboard** - Today's services with status indicators
- [ ] **Service list** - All services with filters (client, date, status)
- [ ] **Status toggle** - Mark services as delivered (Blue → Green)
- [ ] **Client management** - Create/view/deactivate clients
- [ ] **Monthly reports** - Filter by client + date range, export CSV

### Phase 4: Client Features
- [ ] **Client dashboard** - View their services and statuses
- [ ] **Create service** - Simple form with pickup (pre-filled) + delivery location
- [ ] **Service history** - List of all their past services

### Phase 5: PWA & Polish
- [ ] Configure manifest.json with icons
- [ ] Test PWA install flow on mobile
- [ ] Mobile-first UI refinements
- [ ] Error handling and loading states

### Phase 6: Deployment
- [ ] Deploy to Vercel
- [ ] Configure custom domain (if needed)
- [ ] Test end-to-end flow

## Key Features Detail

### Status Indicators
- 🔵 **Blue/Pending**: Service created, awaiting pickup
- 🟢 **Green/Delivered**: Service completed

### Courier Dashboard (Main Screen)
- Shows today's services by default
- Quick filter: Today / Tomorrow / All
- Counter: "5 pending, 12 delivered today"
- Tap to expand service details
- One-tap status change

### Monthly Reports
- Filter by: Client, Date range, Status
- Display: Service count, list of deliveries
- Export: CSV (can be opened in Excel)
- No pricing logic - courier creates invoices manually

## Out of Scope (MVP)

- ❌ Offline support
- ❌ Push notifications
- ❌ Pricing/invoicing logic
- ❌ GPS/maps
- ❌ Route optimization
- ❌ Multi-language

## Verification Plan

1. **Auth flow**: Login as courier, login as client, verify role-based access
2. **Service lifecycle**: Create service → verify Blue status → mark delivered → verify Green
3. **Data isolation**: Client A cannot see Client B's services
4. **PWA install**: Test "Add to Home Screen" on iOS Safari and Android Chrome
5. **Reports**: Filter by month, export CSV, verify data accuracy
6. **Mobile UX**: Test all flows on phone-sized viewport

## Commands Reference

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Supabase local dev
npx supabase start
npx supabase db push
```
