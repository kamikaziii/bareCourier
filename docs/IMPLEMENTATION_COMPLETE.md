# bareCourier - Complete Implementation Documentation

## Overview

bareCourier is a Progressive Web App (PWA) for a solo courier to manage pickups and deliveries, replacing paper-based tracking. This document covers the complete 3-phase implementation that transformed the app from MVP to production-ready.

**Implementation Date**: January 21-22, 2026
**GitHub Issue**: #3

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | SvelteKit | 2.50+ |
| Language | Svelte 5 | 5.47+ (runes syntax) |
| Styling | Tailwind CSS | v4 |
| Components | shadcn-svelte | 1.1+ |
| Backend | Supabase | Auth + Postgres + RLS |
| Maps | Mapbox GL + OpenRouteService | 3.18+ |
| Charts | Chart.js | 4.5+ |
| PWA | @vite-pwa/sveltekit | 1.1+ |
| i18n | Paraglide JS | 2.9+ |
| Deployment | Vercel | adapter-vercel |

---

## Phase 1: Core UX + Full CRUD

### Goal
Fix MVP UX issues and implement proper CRUD operations for services and clients.

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `009_add_service_soft_delete` | Added `deleted_at`, `updated_at` columns to services |
| `010_create_service_status_history` | Track status changes with timestamps and user |
| `011_create_notifications_table` | In-app notification system |
| `012_fix_function_search_paths` | Security fix for function search paths |
| `013_fix_phase1_security_issues` | Additional security hardening |

### New Routes Created

| Route | Purpose |
|-------|---------|
| `/courier/services/[id]` | Service detail page with full info |
| `/courier/services/[id]/edit` | Edit service form |
| `/courier/clients/[id]` | Client detail page with service history |
| `/courier/clients/[id]/edit` | Edit client form |
| `/client/services/[id]` | Client service detail view |

### New Components

| Component | Purpose |
|-----------|---------|
| `NotificationBell.svelte` | Header notification icon with dropdown |

### shadcn-svelte Components Added

```bash
pnpm dlx shadcn-svelte@latest add dialog alert-dialog dropdown-menu tabs badge separator
```

### Key Features

1. **Service Detail Page**: Full info, status history, notes, timestamps
2. **Edit Service**: Modify pickup/delivery locations, notes (courier only)
3. **Delete Service**: Soft delete with confirmation dialog
4. **Status Change**: Proper button with confirmation, not card click
5. **Client Detail Page**: Profile info, service history, statistics
6. **In-App Notifications**: Bell icon with real-time updates

### Database Schema (Phase 1)

```sql
-- service_status_history
CREATE TABLE service_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);

-- notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('service_status', 'new_request', 'schedule_change', 'service_created')),
  title text NOT NULL,
  message text NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## Phase 2: Scheduling + Maps + Notifications

### Goal
Implement time slot scheduling, request approval workflow, maps integration, and external notifications.

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `014_add_scheduling_fields` | Add scheduling and request status fields to services |
| `015_add_location_coordinates` | Add lat/lng and distance_km fields |
| `016_create_push_subscriptions` | PWA push notification subscriptions |

### New Routes Created

| Route | Purpose |
|-------|---------|
| `/courier/requests` | Pending request approval page |
| `/courier/calendar` | Calendar view with day services |

### New Components

| Component | Purpose |
|-----------|---------|
| `SchedulePicker.svelte` | Date + time slot picker |
| `AddressInput.svelte` | Mapbox address autocomplete |
| `RouteMap.svelte` | Display route on Mapbox map |

### shadcn-svelte Components Added

```bash
pnpm dlx shadcn-svelte@latest add calendar popover
```

### Key Features

1. **Scheduling System**:
   - Client requests with preferred date/time slot
   - Time slots: morning, afternoon, evening, specific time
   - Courier can: Accept, Reject (with reason), Suggest alternative

2. **Request Workflow**:
   - `request_status`: pending → accepted/rejected/suggested
   - Client notified of decisions
   - Client can respond to suggestions

3. **Maps Integration**:
   - **Mapbox GL JS**: Map display, geocoding, route visualization
   - **OpenRouteService**: Distance calculation (free API)
   - "Get Directions" button linking to Google/Apple Maps

4. **Calendar View**:
   - Month view with service indicators
   - Day detail with all scheduled services
   - Visual status indicators (pending=blue, delivered=green)

### Database Schema (Phase 2)

```sql
-- Scheduling fields added to services
ALTER TABLE services ADD COLUMN requested_date date;
ALTER TABLE services ADD COLUMN requested_time_slot text;
ALTER TABLE services ADD COLUMN requested_time time;
ALTER TABLE services ADD COLUMN scheduled_date date;
ALTER TABLE services ADD COLUMN scheduled_time_slot text;
ALTER TABLE services ADD COLUMN scheduled_time time;
ALTER TABLE services ADD COLUMN request_status text DEFAULT 'pending';
ALTER TABLE services ADD COLUMN rejection_reason text;
ALTER TABLE services ADD COLUMN suggested_date date;
ALTER TABLE services ADD COLUMN suggested_time_slot text;

-- Coordinates
ALTER TABLE services ADD COLUMN pickup_lat double precision;
ALTER TABLE services ADD COLUMN pickup_lng double precision;
ALTER TABLE services ADD COLUMN delivery_lat double precision;
ALTER TABLE services ADD COLUMN delivery_lng double precision;
ALTER TABLE services ADD COLUMN distance_km double precision;

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

### Environment Variables (Phase 2)

```
PUBLIC_MAPBOX_TOKEN=pk.xxx
PUBLIC_OPENROUTESERVICE_KEY=xxx
```

---

## Phase 3: Billing Tracking + Analytics

### Goal
Implement billing tracking system with multiple pricing models and analytics dashboard.

**Note**: Actual invoicing is handled externally via Moloni (AT-certified software). bareCourier provides data for invoice creation.

### Database Migrations

| Migration | Purpose |
|-----------|---------|
| `017_create_client_pricing` | Client pricing configuration table |
| `018_create_pricing_zones` | Zone-based pricing tiers |
| `019_create_urgency_fees` | Urgency surcharges with defaults |
| `020_add_service_pricing_fields` | Service pricing fields + calculation function |

### New Routes Created

| Route | Purpose |
|-------|---------|
| `/courier/billing` | Billing summary dashboard |
| `/courier/billing/[client_id]` | Client billing detail + pricing config |
| `/courier/analytics` | Analytics dashboard with charts |
| `/courier/settings` | Courier settings + urgency fees |
| `/client/billing` | Client billing view (read-only) |
| `/client/settings` | Client settings |

### New Components

| Component | Purpose |
|-----------|---------|
| `charts/BarChart.svelte` | Bar chart wrapper for Chart.js |
| `charts/LineChart.svelte` | Line chart wrapper for Chart.js |
| `charts/DoughnutChart.svelte` | Doughnut chart wrapper for Chart.js |

### Dependencies Added

```bash
pnpm add chart.js
pnpm dlx shadcn-svelte@latest add textarea
```

### Key Features

1. **Pricing Models** (3 types):
   - **per_km**: Base fee + (distance × rate per km)
   - **flat_plus_km**: Same calculation, different intent
   - **zone**: Fixed price based on distance ranges

2. **Zone Pricing Editor**:
   - Add/remove zones
   - Validation for gaps and overlaps
   - Unlimited max for last zone (null)

3. **Urgency Fees**:
   - Multiplier (e.g., 1.5x = 50% extra)
   - Flat fee addition
   - Toggle active/inactive
   - Delete with confirmation

4. **Billing Dashboard**:
   - Date range filtering
   - Per-client totals (services, km, revenue)
   - CSV export for Moloni import
   - Link to client detail

5. **Analytics Dashboard** (5 charts):
   - Services over time (bar)
   - Revenue over time (line)
   - Distance over time (line)
   - Status distribution (doughnut)
   - Revenue by client (horizontal bar)

6. **Settings Pages**:
   - Profile update (name, phone)
   - Urgency fee management (courier)
   - Default pickup location (client)

### Database Schema (Phase 3)

```sql
-- Client pricing configuration
CREATE TABLE client_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  pricing_model text NOT NULL DEFAULT 'per_km'
    CHECK (pricing_model IN ('per_km', 'zone', 'flat_plus_km')),
  base_fee decimal(10,2) DEFAULT 0,
  per_km_rate decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Zone pricing
CREATE TABLE pricing_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  min_km decimal(10,2) NOT NULL DEFAULT 0,
  max_km decimal(10,2), -- NULL = unlimited
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Urgency fees
CREATE TABLE urgency_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  multiplier decimal(4,2) DEFAULT 1.0,
  flat_fee decimal(10,2) DEFAULT 0,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Pre-populated urgency fees
INSERT INTO urgency_fees (name, description, multiplier, flat_fee, sort_order) VALUES
  ('normal', 'Standard delivery', 1.0, 0, 1),
  ('same_day', 'Same day delivery', 1.25, 0, 2),
  ('rush', 'Rush delivery (2-4 hours)', 1.5, 2.50, 3),
  ('urgent', 'Urgent delivery (< 2 hours)', 2.0, 5.00, 4);

-- Service pricing fields
ALTER TABLE services ADD COLUMN urgency_fee_id uuid REFERENCES urgency_fees(id);
ALTER TABLE services ADD COLUMN calculated_price decimal(10,2);
ALTER TABLE services ADD COLUMN price_breakdown jsonb;

-- Price calculation function
CREATE OR REPLACE FUNCTION calculate_service_price(
  p_client_id uuid,
  p_distance_km double precision,
  p_urgency_fee_id uuid DEFAULT NULL
) RETURNS TABLE(price decimal(10,2), breakdown jsonb) AS $$
-- ... (calculates price based on pricing model)
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies (Phase 3)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `client_pricing` | Courier + own client | Courier | Courier | Courier |
| `pricing_zones` | Courier + own client | Courier | Courier | Courier |
| `urgency_fees` | Public (all) | Courier | Courier | Courier |

---

## Complete Route Structure

### Courier Routes (Protected)

```
/courier                          # Dashboard
/courier/services                 # All services list
/courier/services/[id]            # Service detail
/courier/services/[id]/edit       # Edit service
/courier/clients                  # Clients list
/courier/clients/[id]             # Client detail
/courier/clients/[id]/edit        # Edit client
/courier/requests                 # Pending requests (Phase 2)
/courier/calendar                 # Calendar view (Phase 2)
/courier/billing                  # Billing summary (Phase 3)
/courier/billing/[client_id]      # Client billing detail (Phase 3)
/courier/analytics                # Analytics dashboard (Phase 3)
/courier/reports                  # Monthly reports + CSV
/courier/settings                 # Settings (Phase 3)
```

### Client Routes (Protected)

```
/client                           # Dashboard (my services)
/client/new                       # Create service request
/client/services/[id]             # Service detail (Phase 1)
/client/billing                   # Billing view (Phase 3)
/client/settings                  # Settings (Phase 3)
```

### Public Routes

```
/login                            # Authentication
```

---

## Navigation Updates

### Courier Navigation

```typescript
const navItems = [
  { href: '/courier', label: 'Dashboard' },
  { href: '/courier/services', label: 'Services' },
  { href: '/courier/requests', label: 'Requests' },      // Phase 2
  { href: '/courier/calendar', label: 'Calendar' },      // Phase 2
  { href: '/courier/clients', label: 'Clients' },
  { href: '/courier/billing', label: 'Billing' },        // Phase 3
  { href: '/courier/analytics', label: 'Analytics' },    // Phase 3
  { href: '/courier/reports', label: 'Reports' },
  { href: '/courier/settings', label: 'Settings' }       // Phase 3
];
```

### Client Navigation

```typescript
const navItems = [
  { href: '/client', label: 'My Services' },
  { href: '/client/new', label: 'New Request' },
  { href: '/client/billing', label: 'Billing' },         // Phase 3
  { href: '/client/settings', label: 'Settings' }        // Phase 3
];
```

---

## TypeScript Types

### Core Types

```typescript
// User roles
type Role = 'courier' | 'client';

// Service status
type ServiceStatus = 'pending' | 'delivered';

// Request status (Phase 2)
type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'suggested';

// Time slots (Phase 2)
type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'specific';

// Pricing models (Phase 3)
type PricingModel = 'per_km' | 'zone' | 'flat_plus_km';

// Notification types
type NotificationType = 'service_status' | 'new_request' | 'schedule_change' | 'service_created';
```

### Entity Types

```typescript
type Profile = {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  default_pickup_location: string | null;
  active: boolean;
  created_at: string;
};

type Service = {
  id: string;
  client_id: string;
  pickup_location: string;
  delivery_location: string;
  status: ServiceStatus;
  notes: string | null;
  // ... scheduling fields (Phase 2)
  // ... coordinate fields (Phase 2)
  // ... pricing fields (Phase 3)
};

type ClientPricing = {
  id: string;
  client_id: string;
  pricing_model: PricingModel;
  base_fee: number;
  per_km_rate: number;
};

type PricingZone = {
  id: string;
  client_id: string;
  min_km: number;
  max_km: number | null;
  price: number;
};

type UrgencyFee = {
  id: string;
  name: string;
  description: string | null;
  multiplier: number;
  flat_fee: number;
  active: boolean;
  sort_order: number;
};

type PriceBreakdown = {
  base: number;
  distance: number;
  urgency: number;
  total: number;
  model: PricingModel;
  distance_km: number;
  error?: string;
};
```

---

## Internationalization (i18n)

### Supported Languages

- **Portuguese (Portugal)**: `pt-PT` (primary)
- **English**: `en`

### i18n Keys Added Per Phase

| Phase | Approximate Keys |
|-------|------------------|
| MVP | ~100 |
| Phase 1 | +30 |
| Phase 2 | +40 |
| Phase 3 | +60 |
| **Total** | ~230 |

### Key Categories

```
auth_*          # Authentication
nav_*           # Navigation
status_*        # Status labels
dashboard_*     # Dashboard
services_*      # Services
form_*          # Form fields
clients_*       # Clients
reports_*       # Reports
action_*        # Actions (save, edit, delete)
confirm_*       # Confirmation dialogs
schedule_*      # Scheduling (Phase 2)
requests_*      # Requests (Phase 2)
calendar_*      # Calendar (Phase 2)
map_*           # Maps (Phase 2)
address_*       # Address search (Phase 2)
billing_*       # Billing (Phase 3)
analytics_*     # Analytics (Phase 3)
settings_*      # Settings (Phase 3)
client_*        # Client-specific
```

---

## External Services

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | Database, Auth, RLS | Free tier |
| **Mapbox** | Maps, Geocoding | Free (50k/month) |
| **OpenRouteService** | Distance calculation | Free (2k/day) |
| **Vercel** | Hosting | Free tier |
| **Moloni** | Invoicing (external) | Basic plan |

**Note**: Google Maps API NOT used - $200/month credit removed in March 2025.

---

## Build Status

```
svelte-check found 0 errors and 15 warnings
```

All warnings are expected `state_referenced_locally` for form initializations.

---

## Testing Checklist

### Authentication
- [ ] Login as courier
- [ ] Login as client
- [ ] Role-based redirects work
- [ ] Session persistence

### Phase 1 - CRUD
- [ ] Create service → view detail → edit → soft delete
- [ ] Create client → view detail → edit → archive
- [ ] Status change with confirmation
- [ ] Notifications appear and mark as read

### Phase 2 - Scheduling
- [ ] Client requests with time slot
- [ ] Courier accepts/rejects/suggests
- [ ] Calendar shows services correctly
- [ ] Address autocomplete works
- [ ] Distance calculated
- [ ] Map shows route

### Phase 3 - Billing
- [ ] Configure pricing per client (all 3 models)
- [ ] Zone validation works
- [ ] Service price calculated
- [ ] Billing summary shows correct totals
- [ ] CSV export works
- [ ] Analytics charts display
- [ ] Urgency fees CRUD

### PWA
- [ ] Works offline
- [ ] Install prompt appears
- [ ] Push notifications (if configured)

---

## Architecture Decisions

### Why Mapbox + OpenRouteService?
Google Maps removed the $200/month free credit in March 2025. Mapbox offers 50k free requests/month, and OpenRouteService provides free distance calculations.

### Why No PDF Generation?
The courier uses Moloni (Portuguese AT-certified invoicing software) on the Basic plan. bareCourier provides data export; Moloni handles compliant invoices.

### Why Chart.js Direct Integration?
svelte-chartjs wrappers don't fully support Svelte 5 runes. Direct Chart.js integration with `$effect` for lifecycle management works better.

### Why Soft Delete?
Maintains data integrity for billing history. Services are never truly deleted, just marked with `deleted_at`.

### Why RLS + Explicit Filters?
Defense in depth. RLS provides database-level security, explicit filters in queries provide application-level clarity and additional safety.

---

## File Structure Summary

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/                    # shadcn-svelte components
│   │   ├── charts/                # Chart.js wrappers (Phase 3)
│   │   ├── NotificationBell.svelte (Phase 1)
│   │   ├── SchedulePicker.svelte  (Phase 2)
│   │   ├── AddressInput.svelte    (Phase 2)
│   │   └── RouteMap.svelte        (Phase 2)
│   ├── database.types.ts          # All TypeScript types
│   └── paraglide/                 # i18n runtime
├── routes/
│   ├── courier/                   # All courier routes
│   ├── client/                    # All client routes
│   └── login/                     # Public login
├── hooks.server.ts                # Supabase SSR auth
└── service-worker.ts              # PWA with Supabase caching
messages/
├── en.json                        # English translations
└── pt-PT.json                     # Portuguese translations
supabase/
└── migrations/                    # 20 total migrations
```

---

## Conclusion

The bareCourier implementation is complete across all 3 phases:

1. **Phase 1**: Solid foundation with proper CRUD, soft deletes, status history, and notifications
2. **Phase 2**: Full scheduling workflow with maps integration and calendar views
3. **Phase 3**: Complete billing tracking with flexible pricing models and analytics

The app is production-ready for a solo courier operation, with room for future enhancements like:
- Email notifications (Resend integration)
- Push notifications (Web Push API)
- Moloni API integration (if upgrading to Pro plan)
- Multi-courier support
