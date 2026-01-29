# Pricing Settings & Calculation Design

**Date:** 2025-01-24
**Status:** Approved

## Overview

Fix warehouse pricing mode and add comprehensive pricing settings, enabling price calculation at service creation with configurable visibility for courier and client.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| When pricing matters | Both creation (preview) and billing time | Flexibility for different workflows |
| Price preview visibility | Configurable per role | Courier decides what clients see |
| Price storage | Always calculate and store | Audit trail, billing convenience |
| Override mechanism | Service detail + billing page | Maximum flexibility |
| Distance breakdown storage | In `price_breakdown` JSON | No schema changes, keeps related data together |
| Calculation location | Server-side action | TypeScript logic, better error handling |
| Missing pricing config | Allow with warning | Don't block urgent work |
| Urgency dropdown | "Standard" as virtual NULL option | Clear UX, no database clutter |
| Settings columns | New columns, drop obsolete | Clean naming from the start |

## Database Changes

### Migration: `028_pricing_display_settings.sql`

```sql
-- Remove obsolete column
ALTER TABLE profiles DROP COLUMN IF EXISTS auto_calculate_price;

-- Add display visibility settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_price_to_courier boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_price_to_client boolean DEFAULT true;

-- Optional: Track price overrides
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_override_reason text;

COMMENT ON COLUMN profiles.show_price_to_courier IS 'Whether courier sees price previews in UI';
COMMENT ON COLUMN profiles.show_price_to_client IS 'Whether client sees price previews in UI';
COMMENT ON COLUMN services.price_override_reason IS 'Reason for manual price override';
```

### Complete Courier Pricing Settings

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `pricing_mode` | 'warehouse' \| 'zone' | 'zone' | How distance is calculated |
| `warehouse_lat` | float | null | Warehouse latitude |
| `warehouse_lng` | float | null | Warehouse longitude |
| `show_price_to_courier` | boolean | true | Courier sees price previews |
| `show_price_to_client` | boolean | true | Client sees price previews |
| `default_urgency_fee_id` | uuid | null | Pre-selected urgency for new services |
| `minimum_charge` | numeric | 0 | Floor price for any service |
| `round_distance` | boolean | false | Round km before pricing |

## Price Calculation Flow

```
1. Form submitted to server action
2. Server action:
   a. Validate inputs
   b. Check if client has pricing config
      - If NO: Insert service with calculated_price = NULL, return warning
      - If YES: Continue to calculation
   c. Get courier settings (pricing mode, warehouse coords, minimum charge, etc.)
   d. Calculate distance using calculateServiceDistance()
   e. Calculate price using calculateServicePrice()
   f. Build price_breakdown JSON (includes distance breakdown)
   g. Insert service with all pricing data
3. Return success (with warning if no pricing config)
```

### Price Breakdown JSON Structure

```typescript
interface PriceBreakdown {
  // Price components
  base: number;           // Base fee
  distance: number;       // Distance charge
  urgency: number;        // Urgency surcharge
  total: number;          // Final price

  // Calculation metadata
  model: 'per_km' | 'zone' | 'flat_plus_km';
  distance_km: number;    // Total distance used for pricing

  // Distance breakdown (warehouse mode)
  distance_mode: 'warehouse' | 'zone' | 'fallback';
  warehouse_to_pickup_km?: number;
  pickup_to_delivery_km?: number;
}
```

## UI/UX Specifications

### Urgency Fee Dropdown

```
▼ Urgency
  • Standard (no extra charge)  ← maps to NULL, always first
  • Express (1.5x)              ← from urgency_fees table
  • Same-day (2.0x + €5.00)     ← from urgency_fees table
```

- "Standard" is a virtual option, not stored in database
- Courier's `default_urgency_fee_id` pre-selects the default (NULL = Standard)

### Price Preview Visibility

| Setting | Courier Form | Client Form | Service Detail |
|---------|--------------|-------------|----------------|
| `show_price_to_courier: true` | Shows price | — | Shows price |
| `show_price_to_courier: false` | Hidden | — | Hidden |
| `show_price_to_client: true` | — | Shows price | Shows price (client view) |
| `show_price_to_client: false` | — | Hidden | Hidden (client view) |

### When Price is NULL

- Display: "—" or "Price pending"
- No €0.00 (that implies free)
- Tooltip/hint: "Configure pricing for this client"

### Distance Breakdown (Warehouse Mode)

```
┌─────────────────────────────────┐
│ Warehouse → Pickup      4.2 km │
│ Pickup → Delivery       8.3 km │
│ ─────────────────────────────── │
│ Total distance         12.5 km │
└─────────────────────────────────┘
```

Only shown when `pricing_mode = 'warehouse'` and warehouse coordinates exist.

### Price Override (Service Detail)

```
┌─────────────────────────────────┐
│ Calculated: €24.50              │
│                                 │
│ Override price: [€ ______]      │
│ Reason (optional): [________]   │
│                                 │
│ [Cancel]  [Save Override]       │
└─────────────────────────────────┘
```

- Override stored in `calculated_price`
- Original breakdown preserved in `price_breakdown`
- Optional reason for audit trail

### Billing Page Enhancements

1. **Highlight services without prices** - Visual indicator for `calculated_price = NULL`
2. **Bulk actions:**
   - "Recalculate missing prices" - For NULL services only
   - "Recalculate all" - Entire period using current config
3. **Inline edit** - Adjust individual prices during review (nice-to-have)

## Implementation Files

| File | Changes |
|------|---------|
| `supabase/migrations/028_pricing_display_settings.sql` | New migration |
| `src/lib/database.types.ts` | Update Profile and Service types |
| `src/lib/services/pricing.ts` | Update `getCourierPricingSettings()`, ensure minimum charge works |
| `src/routes/courier/settings/+page.svelte` | Two visibility toggles instead of auto_calculate |
| `src/routes/courier/settings/+page.server.ts` | Update actions for new settings |
| `src/routes/client/new/+page.svelte` | Conditional price display, form changes |
| `src/routes/client/new/+page.server.ts` | **New file** - server action with price calculation |
| `src/routes/courier/services/+page.svelte` | Conditional price display, "Standard" urgency |
| `src/routes/courier/services/+page.server.ts` | **New file** - server action with price calculation |
| `src/routes/courier/services/[id]/+page.svelte` | Price override UI |
| `src/routes/courier/services/[id]/+page.server.ts` | Price override action |
| `src/routes/courier/billing/+page.svelte` | Highlight NULL prices, recalculate buttons |
| `src/routes/courier/billing/+page.server.ts` | Recalculate actions |
| `messages/en.json`, `messages/pt-PT.json` | New i18n keys |

## Out of Scope

- PWA service worker fix (separate task)
- Billing page inline edit (nice-to-have for later)

## i18n Keys Required

```json
{
  "price_pending": "Price pending",
  "price_not_configured": "Configure pricing for this client",
  "urgency_standard": "Standard (no extra charge)",
  "settings_show_price_to_courier": "Show prices to me",
  "settings_show_price_to_courier_desc": "Display price previews in service forms and details",
  "settings_show_price_to_client": "Show prices to clients",
  "settings_show_price_to_client_desc": "Clients see estimated cost when creating requests",
  "price_override": "Override price",
  "price_override_reason": "Reason (optional)",
  "price_calculated": "Calculated",
  "billing_recalculate_missing": "Recalculate missing prices",
  "billing_recalculate_all": "Recalculate all",
  "billing_missing_price_warning": "Some services have no price calculated"
}
```
