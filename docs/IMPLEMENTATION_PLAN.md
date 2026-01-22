# bareCourier - Implementation Plan

## Overview

A simple PWA for a solo courier to manage pickups/deliveries and replace paper tracking.

---

## Status

### MVP (Completed)
- [x] Phase 0: Project Initialization
- [x] Phase 1: Project Setup
- [x] Phase 2: Authentication & Database
- [x] Phase 3: Courier Features
- [x] Phase 4: Client Features
- [x] **Security Review & Fixes** (Post Phase 4)
- [x] Phase 5: PWA & Polish
- [x] Phase 6: Internationalization (i18n)
- [ ] Phase 7: Deployment

### Feature Enhancement (In Progress)
- [x] **Phase 1: Core UX Improvements + Full CRUD** (2025-01-21)
- [x] **Phase 1 Security Fixes** (2025-01-21) - Applied `013_fix_phase1_security_issues.sql`
- [x] **Phase 2: Scheduling + Maps + Notifications** (2025-01-21)
- [ ] Phase 3: Billing Tracking + Analytics

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
  default_pickup_location text,  -- Client's default address (auto-fill)
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
│   ├── manifest.webmanifest      # PWA manifest
│   ├── favicon.ico               # Multi-resolution favicon
│   ├── favicon.svg               # SVG favicon
│   ├── pwa-64x64.png             # Small PWA icon
│   ├── pwa-192x192.png           # Standard PWA icon
│   ├── pwa-512x512.png           # Large PWA icon
│   ├── maskable-icon-512x512.png # Maskable icon for Android
│   ├── apple-touch-icon-180x180.png
│   └── images/                   # Splash screens + logo source
│       ├── logo-1024.png         # Source logo
│       └── apple-splash-*.png    # iOS splash screens (19 sizes)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_fix_rls_policies_performance.sql
│       └── 003_cleanup_duplicate_rls_policies.sql
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
- [x] Implement login page
- [x] Create auth store and guards
- [x] Build profile creation for courier to add clients

### Phase 3: Courier Features
- [x] **Dashboard** - Today's services with status indicators
- [x] **Service list** - All services with filters (client, date, status)
- [x] **Status toggle** - Mark services as delivered (Blue → Green)
- [x] **Client management** - Create/view/deactivate clients
- [x] **Monthly reports** - Filter by client + date range, export CSV

### Phase 4: Client Features
- [x] **Client dashboard** - View their services and statuses
- [x] **Create service** - Simple form with pickup (pre-filled) + delivery location
- [x] **Service history** - List of all their past services

### Security Review & Fixes (Post Phase 4)
- [x] **RLS Performance**: Fixed all policies to use `(select auth.uid())` instead of `auth.uid()`
- [x] **Multiple Permissive Policies**: Consolidated duplicate policies into single unified policies
- [x] **Client Layout Security**: Added null profile check to prevent unauthorized access
- [x] **Client Layout Active Check**: Added active status check to prevent deactivated clients from accessing
- [x] **Client Creation**: Replaced `signUp()` with Edge Function using admin API (no confirmation emails)
- [x] **Home Page Redirect**: Moved from client-side `onMount` to server-side `+page.server.ts`
- [x] **Security Advisors**: Verified 0 security lints after fixes

### Second Review (Additional Fixes)
- [x] **Reports Page State Init**: Fixed $effect to direct state initialization (Svelte 5 best practice)
- [x] **PWA Icons**: Created icons directory with README (icons need to be generated)
- [x] **Edge Function Security**: Verified proper authorization flow with JWT validation
- [x] **Supabase SSR**: Verified hooks.server.ts follows latest @supabase/ssr patterns
- [x] **Svelte 5 Patterns**: All components use correct runes syntax ($state, $derived, $effect, $props)
- [x] **TypeScript Check**: 0 errors, 1 informational warning (expected)

### Phase 5: PWA & Polish
- [x] **PWA Asset Generator**: Installed @vite-pwa/assets-generator + sharp
- [x] **Source Logo**: Created 1024x1024 PNG from favicon.svg
- [x] **PWA Icons**: Generated all sizes (64x64, 192x192, 512x512, maskable)
- [x] **Apple Touch Icon**: Generated 180x180 for iOS
- [x] **iOS Splash Screens**: Generated 19 sizes for all iPhone/iPad models
- [x] **Favicons**: Generated favicon.ico + PNG variants
- [x] **Web App Manifest**: Created manifest.webmanifest with app shortcuts
- [x] **Apple Meta Tags**: Added apple-mobile-web-app-* tags for iOS
- [x] **PWA Install Prompt**: Added beforeinstallprompt handler in app.html
- [x] **Custom Service Worker**: Created with Supabase-aware caching strategies
  - NetworkOnly for Supabase Auth (never cache)
  - NetworkFirst for Supabase Data (cache fallback for offline)
  - Precache for static assets via workbox
- [x] **Vite Config**: Updated to use injectManifest strategy
- [ ] Test PWA install flow on mobile
- [ ] Mobile-first UI refinements (if needed)

### Phase 6: Internationalization (i18n)
- [x] **Paraglide JS 2.0**: Installed and configured for URL-based routing
- [x] **Languages**: Portuguese (pt-PT) as default, English (en) with /en/ prefix
- [x] **Message files**: Created messages/pt-PT.json and messages/en.json
- [x] **SSR Integration**: Paraglide middleware integrated with Supabase hooks
- [x] **Language Switcher**: Added to courier and client layouts
- [x] **SEO**: hreflang tags for all routes
- [x] **PWA**: Manifest updated for Portuguese default
- [x] **Generic App**: Removed industry-specific references

### Phase 7: Deployment
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
pnpm run dev

# Build
pnpm run build

# Preview production build
pnpm run preview

# TypeScript check
pnpm run check

# Add shadcn-svelte component
pnpm dlx shadcn-svelte@latest add [component] --yes

# Generate PWA assets
pnpm run generate-pwa-assets
```

---

## Feature Enhancement Plan

Transform bareCourier from MVP to production-ready courier management system.

### Phase 1: Core UX Improvements + Full CRUD ✅ (Completed 2025-01-21)

#### Database Migrations Applied
- `009_add_service_soft_delete.sql` - Added `deleted_at`, `updated_at` columns
- `010_create_service_status_history.sql` - Status change tracking
- `011_create_notifications_table.sql` - In-app notifications with triggers
- `012_fix_function_search_paths.sql` - Security fix for function search paths

#### New Routes
| Route | Purpose |
|-------|---------|
| `/courier/services/[id]` | Service detail with history |
| `/courier/services/[id]/edit` | Edit service form |
| `/courier/clients/[id]` | Client detail with stats |
| `/courier/clients/[id]/edit` | Edit client form |
| `/client/services/[id]` | Client service detail view |

#### Features Implemented
- **Service Detail Page**: Full info, status history, timestamps, notes
- **Edit/Delete Services**: Proper forms with confirmation dialogs
- **Client Detail Page**: Profile info, service history, statistics
- **Edit/Archive Clients**: Modify or deactivate clients
- **Status Change UX**: Proper buttons with confirmation (not card click)
- **In-App Notifications**: Real-time notifications for status changes and new requests
- **Soft Delete**: Services are soft-deleted for audit trail

#### New Components Added
- Dialog, Alert Dialog, Dropdown Menu, Tabs, Badge, Separator
- NotificationBell component with real-time updates

#### i18n Strings Added
- ~50 new translation keys in PT and EN

### Phase 1 Security Fixes ✅ (Completed 2025-01-21)

#### Database Migration Applied
- `013_fix_phase1_security_issues.sql`

#### Fixes Implemented
1. **RLS Policy Fix**: `services_update` now checks `deleted_at IS NULL` to prevent updating soft-deleted services
2. **RLS Policy Fix**: Removed overly permissive `notifications_insert` policy (triggers use SECURITY DEFINER)
3. **Function Security**: `update_updated_at_column()` now uses SECURITY DEFINER with empty search_path
4. **Database Constraint**: Added CHECK constraint on `notifications.type` column
5. **Input Validation**: Status values validated before database update
6. **Role Verification**: All courier actions verify user role at application level (defense-in-depth)
7. **Error Feedback**: UI components now display action errors to users

#### Files Modified
- `src/routes/courier/services/[id]/+page.server.ts` - Input validation + role verification
- `src/routes/courier/services/[id]/edit/+page.server.ts` - Role verification
- `src/routes/courier/clients/[id]/+page.server.ts` - Role verification
- `src/routes/courier/clients/[id]/edit/+page.server.ts` - Role verification
- `src/routes/courier/services/[id]/+page.svelte` - Error feedback in dialogs
- `src/routes/courier/clients/[id]/+page.svelte` - Error feedback in dialogs

### Phase 2: Scheduling + Maps + Notifications ✅ (Completed 2025-01-21)

#### Database Migrations Applied
- `014_add_scheduling_fields.sql` - Added scheduling fields (requested/scheduled date, time slots, request status)
- `015_add_location_coordinates.sql` - Added coordinate fields (pickup/delivery lat/lng, distance_km)
- `016_create_push_subscriptions.sql` - Created push_subscriptions table for PWA notifications

#### New Routes
| Route | Purpose |
|-------|---------|
| `/courier/requests` | Pending service requests approval workflow |
| `/courier/calendar` | Calendar view with monthly services |

#### Features Implemented
- **SchedulePicker Component**: Date and time slot selection using shadcn calendar
- **Client Service Form**: Updated with optional scheduling (date + time slot)
- **Request Approval Workflow**: Accept/Reject/Suggest alternative actions
- **AddressInput Component**: Mapbox Geocoding API autocomplete (ready for integration)
- **RouteMap Component**: Mapbox GL JS map with pickup/delivery markers and route display
- **Calendar View**: Monthly calendar with service dots, day detail view
- **Push Notification Service**: Subscription management with VAPID keys
- **Custom Service Worker**: Workbox-based with push notification handling
- **Email Notification Edge Function**: `send-notification` for Resend integration

#### New Components Added
- Calendar, Popover (shadcn-svelte)
- SchedulePicker, AddressInput, RouteMap (custom)

#### New Services Created
- `src/lib/services/geocoding.ts` - Mapbox Geocoding API
- `src/lib/services/distance.ts` - OpenRouteService distance calculation
- `src/lib/services/push.ts` - Web Push subscription management

#### Environment Variables Required
```
PUBLIC_MAPBOX_TOKEN=pk.xxx
PUBLIC_OPENROUTESERVICE_KEY=xxx
PUBLIC_VAPID_PUBLIC_KEY=xxx
RESEND_API_KEY=re_xxx (in Supabase secrets)
```

#### i18n Strings Added
- ~40 new translation keys for scheduling, calendar, maps, requests

### Phase 3: Billing Tracking + Analytics (Pending)

#### Database Changes Required
```sql
-- Pricing configuration
CREATE TABLE client_pricing (...);
CREATE TABLE pricing_zones (...);
CREATE TABLE urgency_fees (...);

-- Pricing fields on services
ALTER TABLE services ADD COLUMN urgency_fee_id uuid;
ALTER TABLE services ADD COLUMN calculated_price decimal(10,2);
```

#### Features Planned
- Per-client pricing configuration (per_km, zone, flat_plus_km)
- Billing summary dashboard for Moloni invoice creation
- CSV export for billing periods
- Analytics dashboard with Chart.js
- Client billing portal (view km totals, estimated costs)
- Settings pages for courier and client

### External Services Required

| Service | Purpose | Cost |
|---------|---------|------|
| **Mapbox** | Maps display, geocoding | Free (50k requests/month) |
| **OpenRouteService** | Distance calculation | Free (2,000 requests/day) |
| **Resend** | Email notifications | Free (3,000 emails/month) |
| **Web Push** | Push notifications | Free (self-hosted with VAPID) |
| **Moloni** | Invoicing (external) | Already in use |

**Note**: Google Maps API NOT used - $200/month credit was removed in March 2025
