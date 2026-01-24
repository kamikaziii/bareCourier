# bareCourier UX Redesign - Implementation Plan

**Date**: 2026-01-23
**Updated**: 2026-01-24 (Post-review fixes applied)
**Related**: [Design Document](./2026-01-23-ux-redesign.md)
**Status**: Ready for Implementation

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

| Migration | Task | Description |
|-----------|------|-------------|
| `018_add_client_update_policy.sql` | P1.2 | RLS policy for client service updates |
| `019_add_pricing_mode_to_profiles.sql` | P5B.1 | Pricing calculation mode for courier |

---

## Phase 1: Foundation (Navigation + Layout)

### P1.1 Fix Desktop Centering
**Complexity**: S
**Dependencies**: None
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
- [ ] Content centered on 27" monitor
- [ ] Content area has max-width of ~1152px
- [ ] Padding consistent on all screen sizes

---

### P1.2 Fix #027 RLS Bug - Client Service Updates
**Complexity**: M
**Dependencies**: None
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
- [ ] Client can click "Accept" on suggested service
- [ ] Client can click "Decline" on suggested service
- [ ] Client can cancel pending services (P3.1 dependency)
- [ ] Status updates correctly in database
- [ ] No RLS errors in console
- [ ] Existing courier update functionality unaffected

---

### P1.3 Create Sidebar Component
**Complexity**: L
**Dependencies**: P1.1
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
- [ ] Sidebar renders with all navigation items
- [ ] Active item highlighted based on current route
- [ ] Collapse button toggles icon-only mode
- [ ] Collapse state persisted in localStorage
- [ ] Hidden on screens < 768px

---

### P1.4 Create Mobile Bottom Nav Component
**Complexity**: L
**Dependencies**: P1.3
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
- [ ] Bottom nav visible only on mobile (< 768px)
- [ ] 5 items for courier, 4 for client
- [ ] "More" button opens drawer
- [ ] Drawer contains Clients, Billing, Insights, Settings
- [ ] Active state on current page
- [ ] `env(safe-area-inset-bottom)` applied to bottom nav
- [ ] `viewport-fit=cover` present in meta tag
- [ ] Tested on iPhone X+ simulator/device (no content hidden behind home indicator)

---

### P1.5 Update Courier Layout
**Complexity**: M
**Dependencies**: P1.3, P1.4
**Files**:
- `src/routes/courier/+layout.svelte`

**Changes**:
- Replace horizontal nav with Sidebar (desktop)
- Add MobileBottomNav (mobile)
- Keep header with logo, notifications, logout
- Add main content padding-bottom on mobile for bottom nav

**Acceptance Criteria**:
- [ ] Desktop: Sidebar visible, horizontal nav removed
- [ ] Mobile: Bottom nav visible, top nav hidden (keep header)
- [ ] Content not hidden behind bottom nav
- [ ] Navigation works correctly on all screen sizes

---

### P1.6 Update Client Layout
**Complexity**: M
**Dependencies**: P1.3, P1.4
**Files**:
- `src/routes/client/+layout.svelte`

**Changes**:
- Add Sidebar for desktop
- Add MobileBottomNav for mobile (4 items, no "More")
- Keep header

**Acceptance Criteria**:
- [ ] Desktop: Sidebar visible with 4 items
- [ ] Mobile: Bottom nav with 4 items
- [ ] Consistent with courier layout pattern

---

## Phase 2: Feature Consolidation

### P2.1 Create Insights Page (Combined Analytics + Reports)
**Complexity**: XL
**Dependencies**: Phase 1 complete
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
- [ ] Three tabs functional
- [ ] Overview shows summary cards
- [ ] Charts tab shows all analytics charts
- [ ] Data tab shows filterable table + CSV export
- [ ] Date range persists across tabs
- [ ] Tab state in URL
- [ ] Default to 'overview' tab when no `?tab=` param present
- [ ] Invalid tab values fallback to 'overview'

---

### P2.2 Deprecate Analytics and Reports Routes
**Complexity**: S
**Dependencies**: P2.1
**Files**:
- `src/routes/courier/analytics/+page.svelte`
- `src/routes/courier/reports/+page.svelte`

**Changes**:
- Add redirects to `/courier/insights`
- Keep files temporarily for rollback ability
- Remove from navigation

**Acceptance Criteria**:
- [ ] `/courier/analytics` redirects to `/courier/insights?tab=charts`
- [ ] `/courier/reports` redirects to `/courier/insights?tab=data`
- [ ] Old bookmarks still work

---

### P2.3 Create PricingConfigForm Component
**Complexity**: L
**Dependencies**: None
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
- [ ] All 3 pricing models configurable
- [ ] Zone configuration with add/remove zones
- [ ] Validation (no overlapping zones, required fields)
- [ ] Works in both compact and full modes

---

### P2.4 Add Billing Tab to Client Detail Page
**Complexity**: M
**Dependencies**: P2.3
**Files**:
- `src/routes/courier/clients/[id]/+page.svelte`
- `src/routes/courier/clients/[id]/+page.ts`

**Changes**:
- Add "Billing" tab to existing tabs (Info, Services, Billing)
- Load pricing config in page load
- Embed PricingConfigForm component
- Show pricing summary when not editing

**Acceptance Criteria**:
- [ ] Billing tab visible on client detail
- [ ] Shows current pricing model or "Not configured"
- [ ] Edit button reveals PricingConfigForm
- [ ] Changes save correctly

---

### P2.5 Add Pricing to Client Creation Form
**Complexity**: M
**Dependencies**: P2.3
**Files**:
- `src/routes/courier/clients/+page.svelte`
- Edge function: `create-client`

**Changes**:
- Add collapsible "Pricing Configuration" section
- Optional during creation
- Save pricing config when client is created

**Acceptance Criteria**:
- [ ] Collapsible section after contact info
- [ ] Can create client without pricing (section optional)
- [ ] Pricing saved if provided
- [ ] Works with all 3 pricing models

---

### P2.6 Add Pricing to Client Edit Form
**Complexity**: M
**Dependencies**: P2.3
**Files**:
- `src/routes/courier/clients/[id]/edit/+page.svelte`
- `src/routes/courier/clients/[id]/edit/+page.ts`

**Changes**:
- Load existing pricing config
- Add PricingConfigForm component
- Save on form submit

**Acceptance Criteria**:
- [ ] Existing pricing pre-populated
- [ ] Can add pricing if not previously configured
- [ ] Can update pricing model and rates

---

### P2.7 AddressInput Hints (UX Best Practices)
**Complexity**: M
**Dependencies**: None
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
- [ ] Helper text visible below input at all times
- [ ] Different hint for each state (idle, verified, custom)
- [ ] Maximum 5 suggestions displayed (current default, optimal for UX)
- [ ] Brief highlight animation when suggestion selected
- [ ] Hint can be hidden via prop
- [ ] i18n messages for all hint states
- [ ] Accessible (screen readers announce hints via `aria-live`)

---

### P2.8 Upgrade Courier Service Form
**Complexity**: L
**Dependencies**: P2.7 (AddressInput hints must be complete first)
**Files**:
- `src/routes/courier/services/+page.svelte`

> **Note**: Renumbered from P2.7. Depends on P2.7 (AddressInput enhancements).

**Changes**:
- Replace plain text inputs with AddressInput components
- Add RouteMap preview
- Add distance calculation
- Add SchedulePicker
- Save coordinates to database

**Acceptance Criteria**:
- [ ] Address autocomplete working with hint states
- [ ] Route map shows when both addresses selected
- [ ] Distance calculated and displayed
- [ ] Schedule picker available
- [ ] All data saved to database

---

## Phase 3: Client Features

### P3.1 Client Cancellation
**Complexity**: M
**Dependencies**: P1.2 (RLS fix)
**Files**:
- `src/routes/client/services/[id]/+page.svelte`
- `src/routes/client/services/[id]/+page.server.ts`

**Changes**:
- Add "Cancel Request" button (only when `request_status = 'pending'`)
- Confirmation dialog
- Server action for soft delete
- Notify courier

**Acceptance Criteria**:
- [ ] Cancel button visible only when pending
- [ ] Confirmation dialog before cancel
- [ ] Service soft-deleted (deleted_at set)
- [ ] Redirect to dashboard after cancel
- [ ] Courier notified

---

### P3.2 Client Service Filtering
**Complexity**: M
**Dependencies**: None
**Files**:
- `src/routes/client/+page.svelte`

**Changes**:
- Add status dropdown (All/Pending/Delivered)
- Add search input (pickup/delivery location)
- Add date range picker
- Filter services client-side
- Show result count

**Acceptance Criteria**:
- [ ] Status filter works
- [ ] Search filters by location text
- [ ] Date range filters by created_at
- [ ] Filters combinable
- [ ] "Showing X services" count displayed

---

### P3.3 Client CSV Export
**Complexity**: S
**Dependencies**: None
**Files**:
- `src/routes/client/billing/+page.svelte`

**Changes**:
- Add Export button to header
- Generate CSV with: Date, Route, Distance, Price, Status
- Include totals row
- Download with date range in filename

**Acceptance Criteria**:
- [ ] Export button in billing page header
- [ ] CSV includes all table columns
- [ ] Totals row included
- [ ] Filename includes date range
- [ ] Works in PT and EN locales

---

### P3.4 Dashboard Click Behavior
**Complexity**: S
**Dependencies**: None
**Files**:
- `src/routes/courier/+page.svelte`

**Changes**:
- Change card wrapper from `<button>` to `<a>`
- Add quick-toggle button inside card
- Use `e.stopPropagation()` on toggle button

**Acceptance Criteria**:
- [ ] Clicking card navigates to detail
- [ ] Toggle button changes status
- [ ] Toggle doesn't trigger navigation
- [ ] Visual feedback on hover for both

---

## Phase 4: Notifications

### P4.1 Push Notification Infrastructure
**Complexity**: L
**Dependencies**: None
**Files**:
- `src/sw.ts` (already has push handling - verify/extend)
- `src/lib/services/push.ts` (update existing)
- `src/routes/api/push/subscribe/+server.ts` (new)

**Changes**:
- Generate VAPID keys (store in environment variables)
- Add subscription API endpoint
- Extend existing push service with send capabilities
- Create notification sending function for server-side use

> **Note**: The `push_subscriptions` table **already exists** in the database. No migration needed for this task.

**Existing Infrastructure** (verified):
- `push_subscriptions` table: ✅ exists with columns (id, user_id, endpoint, p256dh, auth, created_at)
- `src/sw.ts` lines 60-104: ✅ push and notificationclick handlers exist
- `src/lib/services/push.ts`: ✅ exists (extend, don't create new)

**New Work Required**:
- VAPID key generation and storage
- Server-side push sending function
- Subscription management API endpoint

**Acceptance Criteria**:
- [ ] VAPID keys generated and stored in `.env`
- [ ] Users can subscribe to push notifications
- [ ] Subscriptions stored in existing `push_subscriptions` table
- [ ] Push notifications received when app closed
- [ ] Push notifications clickable (navigate to relevant page)

---

### P4.2 Email Notification Service
**Complexity**: L
**Dependencies**: None
**Files**:
- `supabase/functions/send-email/index.ts` (new)
- Email templates

**Changes**:
- Create Edge Function for sending emails
- Integrate with Resend or SendGrid
- Create email templates (new request, delivered)

**Acceptance Criteria**:
- [ ] Edge function deployed
- [ ] New request email sent to courier
- [ ] Delivered email sent to client
- [ ] Emails render correctly

---

### P4.3 Notification Preferences
**Complexity**: M
**Dependencies**: P4.1, P4.2
**Files**:
- `src/routes/courier/settings/+page.svelte`
- `src/routes/client/settings/+page.svelte`

**Changes**:
- Add "Notifications" section to settings
- Toggle for push notifications
- Toggle for email notifications
- Save preferences to profile

**Acceptance Criteria**:
- [ ] Push notification toggle works
- [ ] Email notification toggle works
- [ ] Preferences saved to database
- [ ] Respected when sending notifications

---

## Phase 5: Offline Support

### P5.1 IndexedDB Setup
**Complexity**: M
**Dependencies**: None
**Files**:
- `src/lib/services/offline-store.ts` (new)

**Changes**:
- Install `idb-keyval` or similar
- Create stores for: services cache, pending mutations
- Helper functions for CRUD

**Acceptance Criteria**:
- [ ] IndexedDB initialized on app load
- [ ] Services can be cached
- [ ] Pending mutations can be queued

---

### P5.2 Background Sync for Status Changes
**Complexity**: L
**Dependencies**: P5.1
**Files**:
- `src/sw.ts`
- `src/lib/services/sync.ts` (new)
- `package.json` (add `workbox-background-sync`)

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
- [ ] `workbox-background-sync` installed
- [ ] Status changes queued when offline
- [ ] Changes sync automatically when back online
- [ ] Queue persisted in IndexedDB (survives browser restart)
- [ ] Conflicts resolved with last-write-wins
- [ ] User notified of sync status (via OfflineIndicator)
- [ ] Failed syncs retry with exponential backoff (browser-managed)

---

### P5.3 Optimistic UI Updates
**Complexity**: M
**Dependencies**: P5.1, P5.2
**Files**:
- `src/routes/courier/+page.svelte`
- `src/routes/courier/services/[id]/+page.svelte`

**Changes**:
- Update UI immediately on status change
- Show "syncing" indicator
- Rollback if sync fails

**Acceptance Criteria**:
- [ ] UI updates instantly
- [ ] Syncing indicator visible
- [ ] Rollback on failure with error message

---

### P5.4 Offline Indicator Component
**Complexity**: S
**Dependencies**: None
**Files**:
- `src/lib/components/OfflineIndicator.svelte` (new)
- `src/routes/+layout.svelte`

**Changes**:
- Create banner component
- Listen to online/offline events
- Show pending sync count

**Acceptance Criteria**:
- [ ] Banner appears when offline
- [ ] Shows "You're offline - X changes pending"
- [ ] Disappears when back online
- [ ] Styled appropriately (yellow/orange warning)

---

## Phase 5B: Pricing Mode Setting

### P5B.1 Add Pricing Mode to Courier Settings
**Complexity**: M
**Dependencies**: P2.3 (PricingConfigForm)
**Files**:
- `src/routes/courier/settings/+page.svelte`
- `src/routes/courier/settings/+page.server.ts`
- `supabase/migrations/019_add_pricing_mode_to_profiles.sql` (new)
- `src/lib/database.types.ts` (update Profile type)

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
- [ ] Pricing mode setting visible in courier settings
- [ ] Can switch between warehouse and zone modes
- [ ] Setting saved to database
- [ ] Explanation text helps courier understand difference
- [ ] i18n messages for PT and EN
- [ ] Only visible to courier role (not clients)

---

### P5B.2 Update Price Calculation Logic
**Complexity**: M
**Dependencies**: P5B.1
**Files**:
- `src/lib/services/pricing.ts` (new or update)
- Service creation pages

**Changes**:
- Create `calculateServicePrice()` function that respects pricing mode
- If `warehouse` mode: Calculate distance from courier's default location
- If `zone` mode: Look up zone price based on delivery location

**Acceptance Criteria**:
- [ ] Price calculation respects pricing mode setting
- [ ] Warehouse mode includes round-trip distance
- [ ] Zone mode uses zone pricing tables
- [ ] Fallback if zone not configured

---

## Phase 6: Polish

### P6.1 Loading States (Skeleton Screens)
**Complexity**: M
**Dependencies**: None
**Files**:
- `src/lib/components/SkeletonCard.svelte` (new)
- Various page files

**Changes**:
- Create skeleton components
- Replace "Loading..." text with skeletons
- Match layout of actual content

**Acceptance Criteria**:
- [ ] Skeleton screens on Dashboard
- [ ] Skeleton screens on Services list
- [ ] Skeleton screens on Clients list
- [ ] Smooth transition to content

---

### P6.2 Pull-to-Refresh
**Complexity**: M
**Dependencies**: None
**Files**:
- `src/lib/components/PullToRefresh.svelte` (new)
- List pages (Dashboard, Services, Clients)

**Changes**:
- Implement pull-to-refresh gesture with touch events
- Refresh data on pull using SvelteKit's `invalidateAll()`
- Loading indicator with visual feedback
- Prevent conflict with SvelteKit scroll restoration

**Implementation Pattern**:
```svelte
<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  let startY = 0;
  let pulling = $state(false);
  let refreshing = $state(false);
  let pullDistance = $state(0);

  const THRESHOLD = 80; // px to trigger refresh

  function handleTouchStart(e: TouchEvent) {
    // Only activate when at top of page
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pulling || refreshing) return;
    pullDistance = Math.min(e.touches[0].clientY - startY, THRESHOLD * 1.5);
    if (pullDistance > 0) {
      e.preventDefault(); // Prevent native scroll during pull
    }
  }

  async function handleTouchEnd() {
    if (pullDistance >= THRESHOLD) {
      refreshing = true;
      await invalidateAll();
      refreshing = false;
    }
    pulling = false;
    pullDistance = 0;
  }
</script>

<div
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
>
  {#if pullDistance > 0 || refreshing}
    <div class="pull-indicator" style="transform: translateY({pullDistance}px)">
      {refreshing ? 'Refreshing...' : 'Pull to refresh'}
    </div>
  {/if}
  <slot />
</div>
```

**Acceptance Criteria**:
- [ ] Pull gesture detected on mobile (touch events)
- [ ] Only activates when scrolled to top (`scrollY === 0`)
- [ ] Loading indicator shown during refresh
- [ ] Data refreshed via `invalidateAll()`
- [ ] Works on Dashboard, Services, Clients pages
- [ ] Does not conflict with SvelteKit navigation/scroll restoration
- [ ] Visual feedback during pull (distance indicator)

---

### P6.3 Accessibility Audit
**Complexity**: M
**Dependencies**: All other phases
**Files**: Various

**Checks**:
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast meets WCAG AA
- [ ] Focus states visible
- [ ] Screen reader tested

---

### P6.4 Performance Optimization
**Complexity**: M
**Dependencies**: P2.1
**Files**:
- Various

**Checks**:
- [ ] Chart.js tree-shaken (dynamic imports)
- [ ] Images optimized
- [ ] Bundle size analyzed
- [ ] Lighthouse score > 90

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

---

## Task Summary

| Phase | Tasks | Total Complexity |
|-------|-------|------------------|
| Phase 1: Foundation | 6 tasks | 2S + 3M + 1L = ~20h |
| Phase 2: Consolidation | 8 tasks | 1S + 5M + 1L + 1XL = ~34h |
| Phase 3: Client Features | 4 tasks | 2S + 2M = ~8h |
| Phase 4: Notifications | 3 tasks | 1M + 2L = ~14h |
| Phase 5: Offline Support | 4 tasks | 1S + 2M + 1L = ~12h |
| Phase 5B: Pricing Mode | 2 tasks | 2M = ~6h |
| Phase 6: Polish | 4 tasks | 4M = ~12h |
| **Total** | **31 tasks** | **~106h** |

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
