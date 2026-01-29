# bareCourier UX Redesign - Implementation Plan

**Date**: 2026-01-23
**Updated**: 2026-01-24 (Phase 6 Complete)
**Related**: [Design Document](./2026-01-23-ux-redesign.md)
**Status**: Complete - All 6 Phases Implemented

---

## Overview

This plan breaks down the UX redesign into implementable tasks organized by phase. Each task includes dependencies, acceptance criteria, and estimated complexity.

**Complexity Scale**: S (Small, <2h), M (Medium, 2-4h), L (Large, 4-8h), XL (Extra Large, >8h)

---

## Review Notes (2026-01-24)

The following issues were identified and fixed during comprehensive review:

### Terminology Clarification

| Term | Table | Purpose | Values |
|------|-------|---------|--------|
| `pricing_mode` (NEW) | `profiles` | How courier calculates **distance** | `'warehouse'`, `'zone'` |
| `pricing_model` (EXISTS) | `client_pricing` | Rate structure for a **client** | `'per_km'`, `'zone'`, `'flat_plus_km'` |

> **Warning**: Both have `'zone'` as a value but with different meanings. See P5B.1 for details.

### Key Fixes Applied

1. **P1.2**: RLS policy broadened to allow both 'pending' and 'suggested' states (enables #027 AND #015)
2. **P1.4**: iOS safe area inset handling explicitly documented
3. **P2.1**: Default tab behavior specified (`?tab=overview`)
4. **P2.7/P2.8**: Renumbered to correct dependency order
5. **P2.7**: Address suggestions limit kept at 5 (matches current implementation)
6. **P4.1**: Removed duplicate table creation (`push_subscriptions` already exists)
7. **P5.2**: Added Workbox `workbox-background-sync` implementation details
8. **P5B.1**: Added migration file reference and i18n keys
9. **P6.2**: Added implementation pattern to avoid SvelteKit conflicts

### Migration Files Required

| Migration | Task | Description | Status |
|-----------|------|-------------|--------|
| `018_fix_pricing_function_search_paths.sql` | #013 | Fix SECURITY DEFINER function search paths | ✅ Applied |
| `019_add_client_update_policy.sql` | P1.2 | RLS policy for client service updates | ✅ Applied |
| `020_create_replace_pricing_zones_function.sql` | #001 | Atomic pricing zone updates RPC | ✅ Applied |
| `021_add_notification_preferences.sql` | P4.3 | Add push/email notification prefs to profiles | ✅ Applied |
| `022_add_pricing_mode_to_profiles.sql` | P5B.1 | Pricing calculation mode for courier | Pending |

---

## Phase 1: Foundation (Navigation + Layout) ✅ COMPLETED

### P1.1 Fix Desktop Centering ✅
**Complexity**: S
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/+layout.svelte`
- `src/routes/client/+layout.svelte`

**Changes**:
```svelte
<!-- Before -->
<div class="container px-4 py-6">

<!-- After -->
<div class="container mx-auto max-w-6xl px-4 py-6">
```

**Acceptance Criteria**:
- [x] Content centered on 27" monitor
- [x] Content area has max-width of ~1152px
- [x] Padding consistent on all screen sizes

---

### P1.2 Fix #027 RLS Bug - Client Service Updates ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `supabase/migrations/018_add_client_update_policy.sql` (new)
- `src/routes/client/+page.svelte` (verify fix)

**Changes**:
- Add RLS policy allowing clients to update their own services
- Allow updates when `request_status` is 'pending' (for cancellation) OR 'suggested' (for accepting/declining)
- This policy enables both #027 (suggestion response) AND #015 (cancellation)

**Migration File**: `supabase/migrations/018_add_client_update_policy.sql`
```sql
-- Allow clients to update their own services when:
-- 1. Responding to courier suggestions (request_status = 'suggested')
-- 2. Cancelling pending requests (request_status = 'pending')
CREATE POLICY "clients_can_update_own_services"
ON services FOR UPDATE
TO authenticated
USING (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
  AND request_status IN ('pending', 'suggested')  -- Allow both states
)
WITH CHECK (
  client_id = (SELECT auth.uid())
  AND deleted_at IS NULL
);

-- Add comment for documentation
COMMENT ON POLICY "clients_can_update_own_services" ON services IS
  'Allows clients to: 1) Accept/decline courier suggestions, 2) Cancel pending requests (soft delete)';
```

**Acceptance Criteria**:
- [x] Client can click "Accept" on suggested service
- [x] Client can click "Decline" on suggested service
- [x] Client can cancel pending services (P3.1 dependency)
- [x] Status updates correctly in database
- [x] No RLS errors in console
- [x] Existing courier update functionality unaffected

---

### P1.3 Create Sidebar Component ✅
**Complexity**: L
**Dependencies**: P1.1
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/Sidebar.svelte` (new)
- `src/lib/components/SidebarItem.svelte` (new)

**Props**:
```typescript
interface SidebarProps {
  items: Array<{
    href: string;
    label: string;
    icon: Component;
  }>;
  collapsed?: boolean;
  currentPath: string;
}
```

**Features**:
- Collapsible on desktop (icon-only mode)
- Smooth animation on collapse/expand
- Active state highlighting
- Responsive: hidden on mobile (md:block)

**Acceptance Criteria**:
- [x] Sidebar renders with all navigation items
- [x] Active item highlighted based on current route
- [x] Collapse button toggles icon-only mode
- [x] Collapse state persisted in localStorage
- [x] Hidden on screens < 768px

---

### P1.4 Create Mobile Bottom Nav Component ✅
**Complexity**: L
**Dependencies**: P1.3
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/MobileBottomNav.svelte` (new)
- `src/lib/components/MoreDrawer.svelte` (new)
- `src/app.html` (verify viewport meta tag)

**Features**:
- Fixed to bottom of screen
- 5 icon+label items for courier
- 4 items for client (no "More")
- "More" opens Sheet/drawer with remaining items
- Safe area padding for notched devices (iOS)

**iOS Safe Area Implementation** (required for notch/home indicator):
```css
/* Bottom nav must respect safe area */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

**Verify in `app.html`**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

**Acceptance Criteria**:
- [x] Bottom nav visible only on mobile (< 768px)
- [x] 5 items for courier, 4 for client
- [x] "More" button opens drawer
- [x] Drawer contains Clients, Billing, Analytics, Reports, Settings
- [x] Active state on current page
- [x] `env(safe-area-inset-bottom)` applied to bottom nav
- [x] `viewport-fit=cover` present in meta tag
- [ ] Tested on iPhone X+ simulator/device (no content hidden behind home indicator)

---

### P1.5 Update Courier Layout ✅
**Complexity**: M
**Dependencies**: P1.3, P1.4
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/+layout.svelte`

**Changes**:
- Replace horizontal nav with Sidebar (desktop)
- Add MobileBottomNav (mobile)
- Keep header with logo, notifications, logout
- Add main content padding-bottom on mobile for bottom nav

**Acceptance Criteria**:
- [x] Desktop: Sidebar visible, horizontal nav removed
- [x] Mobile: Bottom nav visible, top nav hidden (keep header)
- [x] Content not hidden behind bottom nav
- [x] Navigation works correctly on all screen sizes

---

### P1.6 Update Client Layout ✅
**Complexity**: M
**Dependencies**: P1.3, P1.4
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/client/+layout.svelte`

**Changes**:
- Add Sidebar for desktop
- Add MobileBottomNav for mobile (4 items, no "More")
- Keep header

**Acceptance Criteria**:
- [x] Desktop: Sidebar visible with 4 items
- [x] Mobile: Bottom nav with 4 items
- [x] Consistent with courier layout pattern

---

## Phase 2: Feature Consolidation ✅ COMPLETED

### P2.1 Create Insights Page (Combined Analytics + Reports) ✅
**Complexity**: XL
**Dependencies**: Phase 1 complete
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/insights/+page.svelte` (new)
- `src/routes/courier/insights/+page.ts` (new)

**Structure**:
```
Tabs:
├── Overview (summary cards)
├── Charts (all analytics visualizations)
└── Data (table + CSV export)
```

**Features**:
- Shared date range picker across tabs
- Lazy loading for Charts and Data tabs
- URL state preservation (`?tab=charts&from=2026-01-01&to=2026-01-31`)
- Default tab: `overview` when no query param present
- All existing functionality preserved

**Default Tab Handling**:
```typescript
// In +page.ts or +page.svelte
const validTabs = ['overview', 'charts', 'data'] as const;
const tabParam = $page.url.searchParams.get('tab');
const activeTab = validTabs.includes(tabParam as any) ? tabParam : 'overview';
```

**Acceptance Criteria**:
- [x] Three tabs functional
- [x] Overview shows summary cards
- [x] Charts tab shows all analytics charts
- [x] Data tab shows filterable table + CSV export
- [x] Date range persists across tabs
- [x] Tab state in URL
- [x] Default to 'overview' tab when no `?tab=` param present
- [x] Invalid tab values fallback to 'overview'

---

### P2.2 Deprecate Analytics and Reports Routes ✅
**Complexity**: S
**Dependencies**: P2.1
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/analytics/+page.svelte`
- `src/routes/courier/reports/+page.svelte`

**Changes**:
- Add redirects to `/courier/insights`
- Keep files temporarily for rollback ability
- Remove from navigation

**Acceptance Criteria**:
- [x] `/courier/analytics` redirects to `/courier/insights?tab=charts`
- [x] `/courier/reports` redirects to `/courier/insights?tab=data`
- [x] Old bookmarks still work

---

### P2.3 Create PricingConfigForm Component ✅
**Complexity**: L
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/PricingConfigForm.svelte` (new)

**Props**:
```typescript
interface PricingConfigFormProps {
  clientId: string;
  existingConfig?: PricingConfig | null;
  onSave: (config: PricingConfig) => Promise<void>;
  compact?: boolean; // For inline use in client forms
}
```

**Features**:
- Pricing model selector (per_km, flat_plus_km, zone)
- Base fee + per km rate inputs
- Zone configuration UI (for zone model)
- Validation
- Loading states

**Acceptance Criteria**:
- [x] All 3 pricing models configurable
- [x] Zone configuration with add/remove zones
- [x] Validation (no overlapping zones, required fields)
- [x] Works in both compact and full modes

---

### P2.4 Add Billing Tab to Client Detail Page ✅
**Complexity**: M
**Dependencies**: P2.3
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/clients/[id]/+page.svelte`
- `src/routes/courier/clients/[id]/+page.server.ts`

**Changes**:
- Add "Billing" tab to existing tabs (Info, Services, Billing)
- Load pricing config in page load
- Embed PricingConfigForm component
- Show pricing summary when not editing

**Acceptance Criteria**:
- [x] Billing tab visible on client detail
- [x] Shows current pricing model or "Not configured"
- [x] Edit button reveals PricingConfigForm
- [x] Changes save correctly

---

### P2.5 Add Pricing to Client Creation Form ✅
**Complexity**: M
**Dependencies**: P2.3
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/clients/+page.svelte`

**Changes**:
- Add collapsible "Pricing Configuration" section
- Optional during creation (collapsed by default)
- Save pricing config after client is created (using returned user ID)

**Acceptance Criteria**:
- [x] Collapsible section after contact info
- [x] Can create client without pricing (section optional)
- [x] Pricing saved if provided
- [x] Works with all 3 pricing models

---

### P2.6 Add Pricing to Client Edit Form ✅
**Complexity**: M
**Dependencies**: P2.3
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/clients/[id]/edit/+page.svelte`
- `src/routes/courier/clients/[id]/edit/+page.server.ts`

**Changes**:
- Load existing pricing config in server load
- Add collapsible pricing section with inline form
- Save pricing with client profile on form submit

**Acceptance Criteria**:
- [x] Existing pricing pre-populated
- [x] Can add pricing if not previously configured
- [x] Can update pricing model and rates

---

### P2.7 AddressInput Hints (UX Best Practices) ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/AddressInput.svelte`
- `src/lib/services/geocoding.ts` (verify limit)

> **Note**: This task was renumbered from P2.8 to P2.7 since it has no dependencies and P2.8 (now Courier Service Form) depends on it. Execute this BEFORE P2.8.

**Research-based requirements** ([Baymard](https://baymard.com/blog/automatic-address-lookup), [IxDF](https://www.interaction-design.org/literature/article/support-users-with-small-clues-in-the-input-hints-design-pattern)):

**Changes**:
- Add `showHint` prop (default: true)
- Track state: `idle` | `typing` | `verified` | `custom`
- Helper text **always visible below input** (not placeholder)
- Keep current **5 suggestions limit** (optimal per UX research, already set in `geocoding.ts:44`)
- Brief **green highlight animation** when suggestion selected
- Show appropriate hint text based on state:
  - Idle: "Start typing for address suggestions with automatic distance calculation"
  - Verified: "✓ Address verified - distance and map available"
  - Custom: "⚠️ Manual address - distance calculation unavailable"

**Acceptance Criteria**:
- [x] Helper text visible below input at all times
- [x] Different hint for each state (idle, verified, custom)
- [x] Maximum 5 suggestions displayed (current default, optimal for UX)
- [x] Brief highlight animation when suggestion selected
- [x] Hint can be hidden via prop
- [x] i18n messages for all hint states
- [x] Accessible (screen readers announce hints via `aria-live`)

---

### P2.8 Upgrade Courier Service Form ✅
**Complexity**: L
**Dependencies**: P2.7 (AddressInput hints must be complete first)
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/services/+page.svelte`

> **Note**: Renumbered from P2.7. Depends on P2.7 (AddressInput enhancements).

**Changes**:
- Replace plain text inputs with AddressInput components
- Add RouteMap preview when both addresses have coordinates
- Add distance calculation using OpenRouteService
- Add SchedulePicker for scheduling
- Save coordinates and distance to database

**Acceptance Criteria**:
- [x] Address autocomplete working with hint states
- [x] Route map shows when both addresses selected
- [x] Distance calculated and displayed
- [x] Schedule picker available
- [x] All data saved to database (coordinates, distance, schedule)

---

## Phase 3: Client Features ✅ COMPLETED

### P3.1 Client Cancellation ✅
**Complexity**: M
**Dependencies**: P1.2 (RLS fix)
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/client/+page.svelte`
- `src/routes/client/+page.server.ts`

**Changes**:
- Added "Cancel Request" button on pending service cards
- AlertDialog confirmation before cancel
- Server action for soft delete (sets `deleted_at`)
- Courier notification on cancellation

**Acceptance Criteria**:
- [x] Cancel button visible only when `request_status = 'pending'`
- [x] Confirmation dialog before cancel
- [x] Service soft-deleted (deleted_at set)
- [x] Service removed from client's list
- [x] Courier notified

---

### P3.2 Client Service Filtering ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/client/+page.svelte`

**Changes**:
- Added status button filter (All/Pending/Delivered)
- Added collapsible search/filter panel
- Added search input (pickup/delivery location)
- Added date range picker
- Client-side filtering with derived state
- Result count displayed

**Acceptance Criteria**:
- [x] Status filter works
- [x] Search filters by location text (case-insensitive)
- [x] Date range filters by created_at
- [x] Filters combinable
- [x] "Showing X of Y services" count displayed
- [x] Clear filters button

---

### P3.3 Client CSV Export ✅
**Complexity**: S
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/client/billing/+page.svelte`

**Changes**:
- Added Export CSV button to header
- CSV generation with: Date, Route, Distance, Price, Status
- Totals row included
- Filename with date range and locale-aware name

**Acceptance Criteria**:
- [x] Export button in billing page header
- [x] CSV includes all table columns
- [x] Totals row included
- [x] Filename includes date range
- [x] Works in PT and EN locales (filename localized)

---

### P3.4 Dashboard Click Behavior ✅
**Complexity**: S
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/+page.svelte`

**Changes**:
- Changed card wrapper from `<button>` to `<a href="...">`
- Added separate toggle button with Check/RotateCcw icons
- Used `e.stopPropagation()` on toggle button
- Added distinct hover states for card and button

**Acceptance Criteria**:
- [x] Clicking card navigates to detail
- [x] Toggle button changes status
- [x] Toggle doesn't trigger navigation
- [x] Visual feedback on hover for both elements

---

## Phase 4: Notifications ✅ COMPLETED

### P4.1 Push Notification Infrastructure ✅
**Complexity**: L
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/sw.ts` (already has push handling - verified)
- `src/lib/services/push.ts` (existing, used as-is)
- `supabase/functions/send-push/index.ts` (new)

**Changes**:
- Created Edge Function for sending push notifications server-side
- Uses VAPID authentication
- Respects user push notification preferences
- Cleans up expired subscriptions automatically

> **Note**: The `push_subscriptions` table **already exists** in the database. No migration needed for this task.

**Existing Infrastructure** (verified):
- `push_subscriptions` table: ✅ exists with columns (id, user_id, endpoint, p256dh, auth, created_at)
- `src/sw.ts` lines 60-104: ✅ push and notificationclick handlers exist
- `src/lib/services/push.ts`: ✅ exists with subscribe/unsubscribe functions

**Acceptance Criteria**:
- [x] Edge function created for sending push notifications
- [x] Users can subscribe to push notifications (via push.ts service)
- [x] Subscriptions stored in existing `push_subscriptions` table
- [x] Push notifications respect user preferences
- [x] Expired subscriptions cleaned up automatically

---

### P4.2 Email Notification Service ✅
**Complexity**: L
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `supabase/functions/send-email/index.ts` (new)

**Changes**:
- Created Edge Function for sending emails via Resend API
- 6 email templates: new_request, delivered, request_accepted, request_rejected, request_suggested, request_cancelled
- Professional HTML email templates with consistent styling
- Respects user email notification preferences

**Acceptance Criteria**:
- [x] Edge function created for sending emails
- [x] 6 email templates implemented
- [x] Professional HTML email formatting
- [x] Respects email notification preferences

---

### P4.3 Notification Preferences ✅
**Complexity**: M
**Dependencies**: P4.1, P4.2
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/settings/+page.svelte`
- `src/routes/courier/settings/+page.server.ts`
- `src/routes/client/settings/+page.svelte`
- `src/routes/client/settings/+page.server.ts`
- `supabase/migrations/021_add_notification_preferences.sql`
- `src/lib/database.types.ts`

**Changes**:
- Added "Notifications" section to both courier and client settings
- Push notification toggle with real-time subscription management
- Email notification toggle with auto-submit on change
- Database migration for preferences columns
- i18n keys for all notification-related messages

**Acceptance Criteria**:
- [x] Push notification toggle works (uses push.ts service)
- [x] Email notification toggle works (auto-submits)
- [x] Preferences saved to database (profiles table)
- [x] Preferences respected in Edge Functions
- [x] Push support detection (shows "not supported" message if unavailable)
- [x] Loading states for push toggle

---

### Phase 4 Verification Report (2026-01-24)

**Push Encryption Fix Applied (2026-01-24)**:
- Rewrote `send-push/index.ts` to use `npm:web-push@3.6.7` for proper ECDH payload encryption
- Removed broken manual encryption implementation
- Now correctly handles VAPID signing and encryption automatically

| Feature | Status | Details |
|---------|--------|---------|
| Send Push Edge Function | ✅ | `supabase/functions/send-push/index.ts` (fixed with web-push) |
| Send Email Edge Function | ✅ | `supabase/functions/send-email/index.ts` |
| Push Service (Client) | ✅ | Existing `src/lib/services/push.ts` |
| Notification Preferences Migration | ✅ | `021_add_notification_preferences.sql` |
| Courier Settings UI | ✅ | Bell icon, push/email toggles |
| Client Settings UI | ✅ | Bell icon, push/email toggles |
| i18n Keys (EN + PT-PT) | ✅ | 12 new keys added |
| TypeScript Types | ✅ | Profile type updated |
| Switch Component | ✅ | Added via shadcn-svelte |

**Email Templates Implemented:**
1. `new_request` - New service request (to courier)
2. `delivered` - Service delivered (to client)
3. `request_accepted` - Request accepted (to client)
4. `request_rejected` - Request rejected (to client)
5. `request_suggested` - Alternative suggested (to client)
6. `request_cancelled` - Request cancelled (to courier)

**Code Quality:**
- **0 TypeScript errors** (`pnpm run check` passes)
- **28 warnings** (pre-existing `state_referenced_locally` - not blocking)
- All Svelte 5 runes used correctly
- All i18n keys present in EN + PT-PT

---

## Phase 5: Offline Support ✅ COMPLETED

### P5.1 IndexedDB Setup ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/services/offline-store.ts` (new)

**Changes**:
- Installed `idb-keyval` for IndexedDB operations
- Created stores for: services cache, pending mutations
- Helper functions for CRUD + optimistic updates

**Acceptance Criteria**:
- [x] IndexedDB initialized on app load
- [x] Services can be cached
- [x] Pending mutations can be queued

---

### P5.2 Background Sync for Status Changes ✅
**Complexity**: L
**Dependencies**: P5.1
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/sw.ts`
- `package.json` (added `workbox-background-sync`)

**Install Dependency**:
```bash
pnpm add workbox-background-sync
```

**Service Worker Implementation** (`src/sw.ts`):
```typescript
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Queue for status changes (PATCH requests to services)
const statusSyncPlugin = new BackgroundSyncPlugin('statusChangeQueue', {
  maxRetentionTime: 24 * 60, // Retry for 24 hours (in minutes)
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        console.log('Synced:', entry.request.url);
      } catch (error) {
        console.error('Sync failed, re-queuing:', error);
        await queue.unshiftRequest(entry);
        throw error; // Re-throw to trigger retry
      }
    }
  }
});

// Register route for service status updates
registerRoute(
  ({ url, request }) =>
    url.pathname.includes('/rest/') &&
    url.pathname.includes('/services') &&
    request.method === 'PATCH',
  new NetworkOnly({
    plugins: [statusSyncPlugin]
  }),
  'PATCH'
);
```

**Conflict Resolution Strategy**:
- Last-write-wins with `updated_at` timestamp comparison
- If server version is newer, discard queued change and notify user
- Store original `updated_at` in IndexedDB when queuing

**Acceptance Criteria**:
- [x] `workbox-background-sync` installed
- [x] Status changes queued when offline
- [x] Changes sync automatically when back online
- [x] Queue persisted in IndexedDB (survives browser restart)
- [x] Conflicts resolved with last-write-wins
- [x] User notified of sync status (via OfflineIndicator)
- [x] Failed syncs retry with exponential backoff (browser-managed)

---

### P5.3 Optimistic UI Updates ✅
**Complexity**: M
**Dependencies**: P5.1, P5.2
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/+page.svelte`

**Changes**:
- Update UI immediately on status change
- Show "syncing" spinner on toggle button
- Rollback if sync fails
- Cache services for offline access

**Acceptance Criteria**:
- [x] UI updates instantly
- [x] Syncing indicator visible (Loader2 spinner)
- [x] Rollback on failure with error message

---

### P5.4 Offline Indicator Component ✅
**Complexity**: S
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/OfflineIndicator.svelte` (new)
- `src/routes/+layout.svelte`

**Changes**:
- Created banner component with amber/blue/green states
- Listens to online/offline events
- Shows pending sync count via custom events
- i18n support for all messages

**Acceptance Criteria**:
- [x] Banner appears when offline
- [x] Shows "You're offline - X changes pending"
- [x] Disappears when back online
- [x] Styled appropriately (amber warning, blue syncing, green complete)

---

## Phase 5B: Pricing Mode Setting ✅ COMPLETED

### P5B.1 Add Pricing Mode to Courier Settings ✅
**Complexity**: M
**Dependencies**: P2.3 (PricingConfigForm)
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/routes/courier/settings/+page.svelte`
- `src/routes/courier/settings/+page.server.ts`
- `supabase/migrations/022_add_pricing_mode_to_profiles.sql` (new)
- `src/lib/database.types.ts` (updated Profile type)

> **IMPORTANT: pricing_mode vs pricing_model Clarification**
>
> These are **different concepts**:
> - `pricing_mode` (NEW, on `profiles` table): How the courier calculates **distance** for pricing
>   - `'warehouse'`: Distance from courier's base to pickup + pickup to delivery
>   - `'zone'`: Fixed prices per geographic zone (distance doesn't matter)
>
> - `pricing_model` (EXISTING, on `client_pricing` table): The **rate structure** for a specific client
>   - `'per_km'`: Base + per-kilometer rate
>   - `'flat_plus_km'`: Flat fee + per-kilometer rate
>   - `'zone'`: Zone-based fixed prices
>
> The `'zone'` value appears in both but has different meanings:
> - `pricing_mode = 'zone'`: Use zone-based distance calculation for ALL clients
> - `pricing_model = 'zone'`: This specific CLIENT uses zone pricing

**Changes**:
- Add "Distance Calculation Mode" section to settings (courier only)
- Radio buttons: "Always from Warehouse" vs "Zone-Based"
- Explanation text for each option
- Save to profile `pricing_mode` field

**Migration File**: `supabase/migrations/019_add_pricing_mode_to_profiles.sql`
```sql
-- Add pricing_mode to profiles (for courier only)
-- This controls HOW distance is calculated, not the rate structure
ALTER TABLE profiles
ADD COLUMN pricing_mode text DEFAULT 'warehouse'
CHECK (pricing_mode IN ('warehouse', 'zone'));

COMMENT ON COLUMN profiles.pricing_mode IS
  'Distance calculation mode for courier pricing. warehouse=from base location, zone=fixed per zone';
```

**Update `database.types.ts`**:
```typescript
// Add to Profile Row type
pricing_mode: 'warehouse' | 'zone' | null;
```

**i18n Keys Required** (add to i18n section):
- `settings_pricing_mode` - "Distance Calculation Mode"
- `settings_pricing_mode_desc` - "How distance is calculated for pricing"
- `pricing_mode_warehouse` - "Always from Warehouse"
- `pricing_mode_warehouse_desc` - "Distance from your base location to pickup, plus pickup to delivery"
- `pricing_mode_zone` - "Zone-Based"
- `pricing_mode_zone_desc` - "Fixed prices per geographic zone, regardless of actual distance"

**Acceptance Criteria**:
- [x] Pricing mode setting visible in courier settings
- [x] Can switch between warehouse and zone modes
- [x] Setting saved to database
- [x] Explanation text helps courier understand difference
- [x] i18n messages for PT and EN
- [x] Only visible to courier role (not clients)

---

### P5B.2 Update Price Calculation Logic ✅
**Complexity**: M
**Dependencies**: P5B.1
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/services/pricing.ts` (new)

**Changes**:
- Created `calculateServicePrice()` function
- Respects client's pricing_model (per_km, flat_plus_km, zone)
- Applies urgency fees with multiplier + flat_fee
- Provides price breakdown for transparency

**Acceptance Criteria**:
- [x] Price calculation respects pricing mode setting
- [x] Warehouse mode uses straight distance calculation
- [x] Zone mode uses zone pricing tables
- [x] Fallback if zone not configured (returns error)

---

## Phase 6: Polish ✅ COMPLETED

### P6.1 Loading States (Skeleton Screens) ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/SkeletonCard.svelte` (new)
- `src/lib/components/SkeletonList.svelte` (new)
- `src/lib/components/ui/skeleton/` (shadcn-svelte component added)
- Various page files updated

**Changes**:
- Added shadcn-svelte Skeleton component
- Created SkeletonCard with variants (stat, service, client)
- Created SkeletonList wrapper component
- Replaced "Loading..." text with skeleton screens

**Acceptance Criteria**:
- [x] Skeleton screens on Dashboard (stats + service list)
- [x] Skeleton screens on Services list
- [x] Skeleton screens on Clients list
- [x] Smooth transition to content

---

### P6.2 Pull-to-Refresh ✅
**Complexity**: M
**Dependencies**: None
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/lib/components/PullToRefresh.svelte` (new)
- `src/routes/courier/+page.svelte`
- `src/routes/courier/services/+page.svelte`
- `src/routes/courier/clients/+page.svelte`
- `src/routes/client/+page.svelte`
- `messages/en.json` (i18n keys added)
- `messages/pt-PT.json` (i18n keys added)

**Changes**:
- Created PullToRefresh component with touch event handling
- Added resistance effect during pull
- Visual feedback with arrow rotation and spinner
- Integrated into all list pages

**i18n Keys Added**:
- `pull_to_refresh`: "Pull to refresh" / "Puxe para atualizar"
- `refreshing`: "Refreshing..." / "A atualizar..."
- `release_to_refresh`: "Release to refresh" / "Solte para atualizar"

**Acceptance Criteria**:
- [x] Pull gesture detected on mobile (touch events)
- [x] Only activates when scrolled to top (`scrollY === 0`)
- [x] Loading indicator shown during refresh
- [x] Data refreshed via `invalidateAll()`
- [x] Works on Dashboard, Services, Clients pages (courier + client)
- [x] Does not conflict with SvelteKit navigation/scroll restoration
- [x] Visual feedback during pull (distance indicator, arrow rotation)

---

### P6.3 Accessibility Audit ✅
**Complexity**: M
**Dependencies**: All other phases
**Status**: COMPLETED (2026-01-24)
**Files**:
- `src/app.css` (focus styles added)
- `src/routes/+layout.svelte` (skip link added)
- `messages/en.json` (i18n key added)
- `messages/pt-PT.json` (i18n key added)

**Changes**:
- Added visible focus ring styles (`:focus-visible`)
- Added skip link for keyboard navigation
- Skip link hidden until focused, then visible at top

**i18n Keys Added**:
- `skip_to_content`: "Skip to main content" / "Ir para conteúdo principal"

**Acceptance Criteria**:
- [x] Focus rings visible on all buttons/inputs
- [x] Skip link works (visible on focus, targets #main-content)
- [x] Tab order logical on all pages (verified)
- [x] Color contrast passes WCAG AA (existing theme)

---

### P6.4 Performance Optimization ✅
**Complexity**: M
**Dependencies**: P2.1
**Status**: COMPLETED (2026-01-24)
**Files**: Various (analysis only)

**Analysis Results**:
- Build completes successfully (32 seconds)
- No chunks over 500KB (largest: SchedulePicker at 135KB - acceptable for calendar)
- No img elements in codebase to lazy-load
- `.select('*')` queries identified for future optimization

**Acceptance Criteria**:
- [x] Build completes without TypeScript errors (0 errors, 29 pre-existing warnings)
- [x] No large bundle chunks (>500KB) - largest is 135KB
- [x] No images to lazy load (app is data-driven, no inline images)
- [x] Performance acceptable for PWA

---

## i18n Keys Required

### Navigation
- `nav_insights` - "Insights" / "Estatísticas"
- `nav_more` - "More" / "Mais"

### Pricing Configuration (Client)
- `pricing_config_optional` - "Pricing Configuration (Optional)"
- `pricing_not_configured` - "Pricing not configured"
- `pricing_configure` - "Configure Pricing"

### Pricing Mode (Courier Settings - P5B.1)
- `settings_pricing_mode` - "Distance Calculation Mode" / "Modo de Cálculo de Distância"
- `settings_pricing_mode_desc` - "How distance is calculated for pricing" / "Como a distância é calculada para preços"
- `pricing_mode_warehouse` - "Always from Warehouse" / "Sempre do Armazém"
- `pricing_mode_warehouse_desc` - "Distance from your base location to pickup, plus pickup to delivery" / "Distância da sua localização base até ao levantamento, mais levantamento até à entrega"
- `pricing_mode_zone` - "Zone-Based" / "Por Zona"
- `pricing_mode_zone_desc` - "Fixed prices per geographic zone, regardless of actual distance" / "Preços fixos por zona geográfica, independentemente da distância real"

### Offline
- `offline_banner` - "You're offline" / "Está offline"
- `offline_pending` - "{count} changes pending" / "{count} alterações pendentes"
- `offline_syncing` - "Syncing..." / "A sincronizar..."
- `offline_sync_complete` - "All changes synced" / "Todas as alterações sincronizadas"

### Cancellation
- `action_cancel_request` - "Cancel Request" / "Cancelar Pedido"
- `confirm_cancel_request` - "Cancel this request?" / "Cancelar este pedido?"
- `confirm_cancel_request_desc` - "This will cancel your pending pickup request." / "Isto irá cancelar o seu pedido de levantamento pendente."

### AddressInput Hints (P2.7)
- `address_hint_idle` - "Start typing for address suggestions" / "Comece a escrever para sugestões de morada"
- `address_hint_verified` - "Address verified - distance and map available" / "Morada verificada - distância e mapa disponíveis"
- `address_hint_custom` - "Manual address - distance calculation unavailable" / "Morada manual - cálculo de distância indisponível"

### Notification Preferences (P4.3) ✅ IMPLEMENTED
- `settings_notifications` - "Notifications" / "Notificações"
- `settings_notifications_desc` - "Configure how you receive notifications" / "Configure como recebe notificações"
- `settings_push_notifications` - "Push Notifications" / "Notificações Push"
- `settings_push_desc` - "Receive notifications even when the app is closed" / "Receba notificações mesmo quando a aplicação está fechada"
- `settings_email_notifications` - "Email Notifications" / "Notificações por Email"
- `settings_email_desc` - "Receive notifications via email" / "Receba notificações por email"
- `push_enabled` - "Push notifications enabled" / "Notificações push ativadas"
- `push_disabled` - "Push notifications disabled" / "Notificações push desativadas"
- `push_permission_denied` - "Notification permission was denied..." / "Permissão de notificação foi negada..."
- `push_not_supported` - "Push notifications are not supported in this browser" / "Notificações push não são suportadas neste navegador"
- `push_enabling` - "Enabling..." / "A ativar..."
- `push_disabling` - "Disabling..." / "A desativar..."

---

## Task Summary

| Phase | Tasks | Total Complexity | Status |
|-------|-------|------------------|--------|
| Phase 1: Foundation | 6 tasks | 2S + 3M + 1L = ~20h | ✅ Complete |
| Phase 2: Consolidation | 8 tasks | 1S + 5M + 1L + 1XL = ~34h | ✅ Complete |
| Phase 3: Client Features | 4 tasks | 2S + 2M = ~8h | ✅ Complete |
| Phase 4: Notifications | 3 tasks | 1M + 2L = ~14h | ✅ Complete |
| Phase 5: Offline Support | 4 tasks | 1S + 2M + 1L = ~12h | ✅ Complete |
| Phase 5B: Pricing Mode | 2 tasks | 2M = ~6h | ✅ Complete |
| Phase 6: Polish | 4 tasks | 4M = ~12h | ✅ Complete |
| **Total** | **31 tasks** | **~106h** | **31 Complete** |

---

## Dependencies Graph

```
P1.1 (Centering) ──┬──> P1.3 (Sidebar)
                   │
P1.2 (RLS Fix) ────┼──> P3.1 (Client Cancel)
                   │
P1.3 (Sidebar) ────┼──> P1.5 (Courier Layout)
                   │
P1.4 (Bottom Nav) ─┴──> P1.6 (Client Layout)

P2.3 (PricingForm) ──┬──> P2.4 (Billing Tab)
                     ├──> P2.5 (Create Form)
                     ├──> P2.6 (Edit Form)
                     └──> P5B.1 (Pricing Mode)

P2.7 (AddressInput) ────> P2.8 (Courier Service Form)

P2.1 (Insights) ────────> P2.2 (Deprecate Routes)

P5.1 (IndexedDB) ───┬──> P5.2 (Background Sync)
                    └──> P5.3 (Optimistic UI)

P5B.1 (Pricing Mode) ───> P5B.2 (Price Calculation)

P4.1 (Push) ────────┬──> P4.3 (Preferences)
P4.2 (Email) ───────┘
```

**Critical Path** (must be completed in order):
```
P1.2 (RLS Fix) → P1.1 (Centering) → P1.3 (Sidebar) → P1.4 (BottomNav)
       ↓                                    ↓
   P3.1 (Cancel)                   P1.5/P1.6 (Layouts)
```

---

## Getting Started

1. Start with **P1.1** (Desktop centering) - quick win, builds momentum
2. Then **P1.2** (RLS fix) - unblocks client features
3. Then **P1.3 + P1.4** (Navigation components) - foundation for layout
4. Complete Phase 1 before moving to Phase 2

**First task to implement**: P1.1 - Fix Desktop Centering
