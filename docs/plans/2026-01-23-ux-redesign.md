# bareCourier UX Redesign - Design Document

**Date**: 2026-01-23
**Status**: Approved
**Author**: Claude (with user collaboration)

---

## Executive Summary

This document outlines the comprehensive UX redesign for bareCourier, a PWA for a solo courier managing pickups and deliveries for business clients. The redesign addresses navigation architecture, feature placement, mobile experience, and offline support while avoiding over-engineering.

---

## Design Decisions

### 1. Navigation Architecture

#### Decision: Sidebar (Desktop) + Bottom Nav (Mobile)

**Courier Navigation:**
- **Desktop**: Collapsible sidebar with flat icon list
- **Mobile**: Fixed bottom nav with 5 items + "More" drawer

**Sidebar Items (8 items, flat list with icons):**
1. Dashboard (Home icon)
2. Services (Package icon)
3. Requests (Inbox icon)
4. Calendar (Calendar icon)
5. Clients (Users icon)
6. Billing (Receipt icon)
7. Insights (BarChart icon) - *Combined Analytics + Reports*
8. Settings (Settings icon)

**Mobile Bottom Nav (5 items):**
1. Dashboard
2. Services
3. Requests
4. Calendar
5. More → Opens drawer with: Clients, Billing, Insights, Settings

**Client Navigation:**
- **Desktop**: Sidebar (consistent with courier)
- **Mobile**: Bottom nav (4 items fit perfectly, no "More" needed)

**Client Nav Items:**
1. My Services
2. New Request
3. Billing
4. Settings

**Rationale**:
- Research shows bottom nav increases engagement 65%+ vs hamburger menus
- Sidebar scales for future features
- Consistent desktop experience, optimal mobile experience

---

### 2. Analytics + Reports Consolidation

#### Decision: Combine into "Insights" Page with Tabs

**Structure:**
```
/courier/insights
├── Overview Tab (Summary cards from Reports)
├── Charts Tab (All charts from Analytics)
└── Data Tab (Table with filters + CSV export)
```

**Implementation Notes:**
- Lazy load tab content to avoid performance issues
- Date range picker shared across all tabs
- Maintain URL state: `/courier/insights?tab=charts&from=2026-01-01&to=2026-01-31`

**Rationale**: Reduces cognitive load of "which one do I need?" while keeping distinct purposes accessible.

---

### 3. Pricing Configuration Location

#### Decision: Available Everywhere (Maximum Discoverability)

**Locations:**
1. **Client Creation Form**: Collapsible "Pricing Configuration" section (optional during creation)
2. **Client Edit Form**: Same pricing section, pre-populated if exists
3. **Client Detail Page**: New "Billing" tab showing current pricing + edit capability
4. **Billing Page**: Keep existing detailed view for service history context

**Implementation:**
- Create reusable `PricingConfigForm.svelte` component
- Used in all 4 locations
- Handles all 3 pricing models (per_km, flat_plus_km, zone)

**Rationale**: Settings should be near related entities. Courier shouldn't hunt for pricing config.

---

### 4. Client Features

#### 4.1 Calendar View
**Decision**: No - List view is sufficient

Clients typically have 5-20 services, not 100+. A filtered list with dates is enough. Calendar would be over-engineering.

#### 4.2 Cancellation
**Decision**: Simple approach (Industry Standard)

- Client can cancel when `request_status = 'pending'`
- Once courier accepts, client must contact courier directly
- Matches Uber/DoorDash pattern

**Implementation:**
- Add "Cancel Request" button on client service detail page
- Only visible when `request_status = 'pending'`
- Soft delete (set `deleted_at`)
- Notify courier via push notification

#### 4.3 Filtering
**Decision**: All filters (Status + Search + Date Range)

- Status dropdown: All / Pending / Delivered
- Search: By pickup/delivery location
- Date range picker: Start date, end date

#### 4.4 CSV Export
**Decision**: Yes

- Available on client billing page
- Includes: Date, Route, Distance, Price, Status
- Filename: `my_billing_{start_date}_to_{end_date}.csv`

---

### 5. Courier Dashboard

#### Click Behavior
**Decision**: Navigate to detail page

- Clicking service card → Opens service detail page
- Add explicit toggle button (CheckCircle icon) for quick status change
- Button uses `e.stopPropagation()` to prevent navigation

**Before:**
```svelte
<button onclick={() => toggleStatus(service)}>
  <Card.Content>...</Card.Content>
</button>
```

**After:**
```svelte
<a href="/courier/services/{service.id}">
  <Card.Content>
    ...
    <button onclick={(e) => { e.stopPropagation(); toggleStatus(service); }}>
      <CheckCircle />
    </button>
  </Card.Content>
</a>
```

---

### 6. Courier Service Creation Form

#### Decision: Full Parity with Client Form

**Components to add:**
- `AddressInput` for pickup/delivery (autocomplete)
- `RouteMap` for route preview
- Distance calculation (OpenRouteService + Haversine fallback)
- `SchedulePicker` for scheduling

**Fields saved:**
- `pickup_lat`, `pickup_lng`
- `delivery_lat`, `delivery_lng`
- `distance_km`
- `scheduled_date`, `scheduled_time_slot`

**Note**: When courier creates service, use `scheduled_*` fields (confirmed schedule), not `requested_*` fields (client request).

---

### 6B. AddressInput Flexibility

#### Decision: Suggestions Are Optional (Keep Current) + Add Hints

The AddressInput component allows users to type any address - suggestions are helpful but not required.

**Current behavior (keep):**
- User types → Suggestions appear if found in Mapbox
- User can select a suggestion (coordinates captured) OR
- User can ignore suggestions and type any address (no coordinates)
- Service saves either way

**Enhancement: Add helper text (following UX best practices)**

Based on industry research ([Baymard](https://baymard.com/blog/automatic-address-lookup), [IxDF](https://www.interaction-design.org/literature/article/support-users-with-small-clues-in-the-input-hints-design-pattern)):

**Best Practices Applied:**
1. Helper text **always visible below input** (not in placeholder)
2. Manual entry **always allowed** as fallback
3. Max **10 suggestions** shown
4. **Visual feedback** when suggestion selected

**Helper text states:**

*Default (before interaction):*
```
┌─────────────────────────────────────────┐
│ Enter pickup address                    │
└─────────────────────────────────────────┘
ℹ️ Start typing for address suggestions with automatic distance calculation
```

*When suggestion selected (success):*
```
┌─────────────────────────────────────────┐
│ Rua Augusta 123, Lisboa ✓               │  ← Brief green highlight
└─────────────────────────────────────────┘
✓ Address verified - distance and map available
```

*When custom text entered (no suggestion selected):*
```
┌─────────────────────────────────────────┐
│ Rua do Cliente 456, Vila Nova           │
└─────────────────────────────────────────┘
⚠️ Manual address - distance calculation unavailable
```

**Implementation:**
- Add `showHint` prop to AddressInput (default: true)
- Track state: `idle` | `typing` | `verified` | `custom`
- Show appropriate hint text below input
- Brief highlight animation when suggestion selected
- Limit suggestions to 10 items

**Why this matters:**
- Coordinates enable: map preview, distance calculation, pricing
- Without coordinates: service still works, but pricing may need manual override
- Research shows autocomplete reduces errors by 20%+ and entry time by 78%

---

### 7. Desktop Layout

#### Decision: Max-width Centered Content

- Sidebar fixed on left
- Main content area: `max-w-6xl mx-auto`
- Comfortable reading width on large monitors
- Solves the "left-aligned on 27" screen" issue

**CSS:**
```css
main {
  max-width: 1152px; /* max-w-6xl */
  margin: 0 auto;
  padding: 1.5rem;
}
```

---

### 8. Notifications

#### Decision: Push + Email for Critical Events

**Push Notifications (all events):**
- New service request (to courier)
- Request accepted/rejected/suggested (to client)
- Status change (to client when delivered)
- Service cancelled (to courier)

**Email Notifications (critical only):**
- New service request (to courier)
- Service delivered (to client)

**Implementation:**
- Use Web Push API for push notifications
- Supabase Edge Function + email service (Resend/SendGrid) for emails
- Add notification preferences in Settings

---

### 9. Urgency Fees

#### Decision: Keep in Settings

Urgency fees are configured once, rarely changed. Current placement in Settings is appropriate.

---

### 10. Pricing Calculation Mode

#### Decision: Courier Chooses in Settings

The courier can choose between two pricing calculation modes:

**Option 1: "Always from Warehouse"**
- Distance calculated from courier's default location (warehouse/base)
- Includes round-trip consideration in pricing
- Best for: Couriers who want consistent, predictable pricing

**Option 2: "Zone-Based"**
- Fixed prices per geographic zone
- Distance doesn't matter within a zone
- Best for: Couriers covering large areas with varying demand

**Implementation:**
- Add `pricing_mode` field to courier profile: `'warehouse' | 'zone'`
- Add setting toggle in Courier Settings page
- When calculating service price:
  - If `warehouse` mode: Use distance from `default_pickup_location` to pickup, plus pickup to delivery
  - If `zone` mode: Look up zone price from `pricing_zones` table

**Database:**
```sql
ALTER TABLE profiles
ADD COLUMN pricing_mode text DEFAULT 'warehouse'
CHECK (pricing_mode IN ('warehouse', 'zone'));
```

---

### 10. Offline Support

#### Decision: Full Offline for Read + Status + Notes

**What works offline:**
- ✅ View all services (cached)
- ✅ Toggle service status (pending ↔ delivered)
- ✅ Add/edit notes on services
- ❌ Create new services (requires connection)
- ❌ Client management (requires connection)

**Implementation:**
1. **Background Sync API**: Queue mutations when offline
2. **IndexedDB**: Store pending changes locally
3. **Optimistic UI**: Update UI immediately, sync in background
4. **Conflict Resolution**: Last-write-wins with timestamp comparison
5. **Offline Indicator**: Visual banner showing "You're offline - changes will sync"

**Service Worker Enhancements:**
```typescript
// Register background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-status-changes') {
    event.waitUntil(syncStatusChanges());
  }
});
```

---

## Implementation Phases

### Phase 1: Foundation (Navigation + Layout)
1. Fix desktop centering (`mx-auto`)
2. Implement sidebar component
3. Implement mobile bottom nav component
4. Create responsive layout system
5. Fix #027 RLS bug (production blocker)

### Phase 2: Feature Consolidation
1. Combine Analytics + Reports → Insights
2. Move pricing config to client management (create `PricingConfigForm` component)
3. Add Billing tab to client detail page
4. Update courier service form with rich components

### Phase 3: Client Features
1. Client cancellation (pending only)
2. Client filtering (status + search + date range)
3. Client CSV export
4. Dashboard click behavior fix

### Phase 4: Notifications
1. Push notification infrastructure
2. Email notification setup (Edge Function)
3. Notification preferences in Settings

### Phase 5: Offline Support
1. Background sync for status changes
2. IndexedDB for pending mutations
3. Optimistic UI updates
4. Offline indicator component
5. Conflict resolution logic

### Phase 6: Polish
1. Loading states (skeleton screens)
2. Pull-to-refresh on list views
3. Accessibility audit
4. Performance optimization

---

## Technical Considerations

### New Components Needed
- `Sidebar.svelte` - Collapsible sidebar navigation
- `MobileBottomNav.svelte` - Fixed bottom navigation
- `MoreDrawer.svelte` - Sheet/drawer for secondary nav items
- `PricingConfigForm.svelte` - Reusable pricing configuration
- `OfflineIndicator.svelte` - Offline status banner
- `ServiceFilters.svelte` - Reusable filtering component

### Database Changes
- No schema changes required
- RLS policy addition for client cancellation (soft delete)

### External Services
- Web Push API (already partially implemented)
- Email service: Resend or SendGrid via Supabase Edge Function

### Dependencies to Add
- `idb` or `idb-keyval` for IndexedDB wrapper
- No new UI component libraries needed (shadcn-svelte has Sheet)

---

## Success Metrics

1. **Navigation Efficiency**: Reduce clicks to reach any feature by 30%
2. **Mobile Usability**: Bottom nav items accessible within thumb reach
3. **Offline Reliability**: 100% of status changes sync successfully
4. **Feature Discoverability**: Pricing config found without help in <3 clicks

---

## Appendix: Research Sources

- [UXPin: Mobile Navigation Patterns](https://www.uxpin.com/studio/blog/mobile-navigation-patterns-pros-and-cons/)
- [AppMySite: Bottom Navigation Guide](https://blog.appmysite.com/bottom-navigation-bar-in-mobile-apps-heres-all-you-need-to-know/)
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Toptal: Settings UX](https://www.toptal.com/designers/ux/settings-ux)
- [Lazarev: Logistics UX Design](https://www.lazarev.agency/articles/logistics-ux-ui-design)
- [DeliveryApp: Cancellation Policy](https://www.deliveryapp.com/cancellation-policy/)
