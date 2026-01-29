# Pricing Model Redesign - Design Document

**Date:** 2025-01-29
**Status:** In Progress (Brainstorming)
**Author:** Filipe Garrido + Claude
**Skills Used:** `superpowers:brainstorming`, `compound-engineering:research:best-practices-researcher`

---

## Context & Discovery Process

### Source of Requirements
Requirements gathered from WhatsApp conversation with Agostinho (the courier) at `/Users/filipegarrido/Downloads/_chat 3.txt`.

### Key Quotes from Agostinho (Portuguese)

**Service Types:**
- "em material óptico eu tenho um preço, e em material dentário tenho outro" (line 137)
- "Dental 4€, Ótica 3€" (lines 189-190)

**Normal In-Zone Pricing:**
- "dentro das minhas zonas de distribuição eu cobro a 4€ mais Iva por entrega" (line 141)

**Time-Specific Pricing:**
- "Todo o serviço que o cliente me peça horas, ex 11:30 ou 8:30, tudo que mencione horas eu cobro 13€ mais Iva" (line 157)
- "É um valor fixo 13€" (confirmed €13 REPLACES base type, not adds to it)

**Out-of-Zone Pricing:**
- "Eu fora de zonas de distribuição, cobro 0,50 cêntimos por quilómetro, mais o valor do serviço especial e as portagens" (line 160)

**Zone Definition:**
- "As minhas zonas eu defino por concelhos, Maia, Matosinhos, Porto, Gondomar etc etc" (line 191)
- Zones are GEOGRAPHIC (municipalities), NOT distance-based

**Tolls:**
- "Portagens cobro o valor da portagem exato" (line 192)
- Manual entry of exact toll amount

**Client-Type Association:**
- "o cliente de material dentário só trabalha com dentaduras e o das lentes só trabalha com material ótico" (line 176)
- Each client has a default service type

---

## Problem Statement

### Current Implementation (What We Built)
The current pricing system is **distance-based**:

```typescript
type PricingModel = 'per_km' | 'zone' | 'flat_plus_km';
```

- `per_km`: base_fee + (distance × per_km_rate)
- `zone`: Fixed price brackets by distance (0-5km = €5, 5-10km = €7, etc.)
- `flat_plus_km`: Same as per_km (semantic difference)

**Current Tables:**
- `client_pricing`: per-client pricing config (model, base_fee, per_km_rate)
- `pricing_zones`: distance brackets for zone model
- `urgency_fees`: multiplier + flat_fee for urgent deliveries

### What Agostinho Actually Does (Reality)
His pricing is **type-based with geographic zones**:

| Scenario | Price Calculation |
|----------|-------------------|
| Normal in-zone | Base type price (Dental €4, Optical €3) |
| Time-specific (any) | **€13 flat** (replaces base type) |
| Out-of-zone (any) | **€13 + €0.50/km + tolls** |

**Key Differences:**
1. Price determined by SERVICE TYPE, not distance
2. Zones are GEOGRAPHIC (municipalities), not distance brackets
3. Time-specific and out-of-zone use fixed €13 base (type doesn't matter)
4. Tolls are manual entry (exact amount)

---

## Confirmed Pricing Logic

### Scenario Matrix

| Service Type | In-Zone Normal | In-Zone Time-Specific | Out-of-Zone |
|--------------|----------------|----------------------|-------------|
| Dental | €4 | €13 | €13 + €0.50/km + tolls |
| Optical | €3 | €13 | €13 + €0.50/km + tolls |
| Any other | Type price | €13 | €13 + €0.50/km + tolls |

**Rules:**
1. Base type price ONLY applies to normal in-zone deliveries
2. Time-specific = €13 flat (type doesn't affect price)
3. Out-of-zone = €13 + distance fee + tolls (type doesn't affect price)
4. "Serviço Especial" (€13) is the base for both time-specific AND out-of-zone

---

## Design Decisions (from Brainstorming)

### Q1: Replace or keep current pricing system?
**Decision:** Keep both systems
- Add type-based pricing alongside existing distance-based models
- More flexible for different courier needs in the future

### Q2: How to select pricing system per client?
**Decision:** Global setting with per-client override
- Courier sets default pricing mode in global settings
- Can override per client if needed

### Q3: Who manages service types?
**Decision:** Courier only
- Courier creates/edits/deletes types in settings
- Types are global (same types available for all clients)
- Client has a default type assigned

### Q4: How to define distribution zones?
**Decision:** Structured selection of Portuguese municipalities
- Pre-populated list of concelhos
- Courier selects which ones are "in zone"
- More accurate than free-text matching

### Q5: How to detect in-zone vs out-of-zone?
**Decision:** Auto-detect from delivery address
- Parse delivery address to extract municipality
- Match against courier's zone list
- Automatic pricing adjustment

---

## Data Model Design

### New Table: `service_types`

```sql
CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- "Dental", "Óptica", etc.
  price numeric(10,2) NOT NULL,          -- 4.00, 3.00, etc.
  description text,                      -- Optional description
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: Courier can manage, clients can read
```

### New Table: `distribution_zones`

```sql
CREATE TABLE distribution_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_code text NOT NULL,       -- Portuguese concelho code
  municipality_name text NOT NULL,       -- "Porto", "Maia", etc.
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS: Courier only
```

### Updates to `profiles` (courier settings)

```sql
ALTER TABLE profiles ADD COLUMN pricing_system text DEFAULT 'distance';
-- 'distance' (current) or 'type' (new)

ALTER TABLE profiles ADD COLUMN time_specific_price numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN out_of_zone_base_price numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN out_of_zone_per_km numeric(10,2) DEFAULT 0.50;
```

### Updates to `profiles` (client settings)

```sql
ALTER TABLE profiles ADD COLUMN default_service_type_id uuid REFERENCES service_types(id);
ALTER TABLE profiles ADD COLUMN client_pricing_system text; -- NULL = use global, or override
```

### Updates to `services`

```sql
ALTER TABLE services ADD COLUMN service_type_id uuid REFERENCES service_types(id);
ALTER TABLE services ADD COLUMN is_time_specific boolean DEFAULT false;
ALTER TABLE services ADD COLUMN is_out_of_zone boolean DEFAULT false;
ALTER TABLE services ADD COLUMN detected_municipality text;  -- Auto-detected from address
ALTER TABLE services ADD COLUMN tolls numeric(10,2) DEFAULT 0;
```

---

## Price Calculation Logic

```typescript
interface TypeBasedPriceInput {
  serviceTypeId: string;
  isTimeSpecific: boolean;
  isOutOfZone: boolean;
  distanceKm: number | null;  // Only needed if out-of-zone
  tolls: number;
}

function calculateTypeBasedPrice(
  input: TypeBasedPriceInput,
  settings: CourierSettings,
  serviceType: ServiceType
): number {
  // Rule 1: Time-specific = fixed price (replaces base)
  if (input.isTimeSpecific && !input.isOutOfZone) {
    return settings.timeSpecificPrice; // €13
  }

  // Rule 2: Out-of-zone = base + km + tolls
  if (input.isOutOfZone) {
    const kmFee = (input.distanceKm || 0) * settings.outOfZonePerKm;
    return settings.outOfZoneBasePrice + kmFee + input.tolls;
  }

  // Rule 3: Normal in-zone = type price
  return serviceType.price;
}
```

---

## UI Changes Required

### Courier Settings Page

**New Section: Service Types**
```
┌─────────────────────────────────────────────────┐
│ Service Types                    [+ Add Type]   │
├─────────────────────────────────────────────────┤
│ Dental                    €4.00        [Edit]   │
│ Óptica                    €3.00        [Edit]   │
│ Farmácia                  €4.50        [Edit]   │
└─────────────────────────────────────────────────┘
```

**New Section: Special Pricing**
```
┌─────────────────────────────────────────────────┐
│ Special Pricing                                 │
├─────────────────────────────────────────────────┤
│ Time-specific delivery price    [€13.00    ]    │
│ Out-of-zone base price          [€13.00    ]    │
│ Out-of-zone per km              [€0.50     ]    │
└─────────────────────────────────────────────────┘
```

**New Section: Distribution Zones**
```
┌─────────────────────────────────────────────────┐
│ My Distribution Zones            [+ Add Zone]   │
├─────────────────────────────────────────────────┤
│ ☑ Porto                                         │
│ ☑ Maia                                          │
│ ☑ Matosinhos                                    │
│ ☑ Gondomar                                      │
│ ☐ Vila Nova de Gaia                             │
│ ☐ Valongo                                       │
│ [Show all municipalities...]                    │
└─────────────────────────────────────────────────┘
```

### Client Creation/Edit

**New Field: Default Service Type**
```
┌─────────────────────────────────────────────────┐
│ Default Service Type                            │
│ [Dental ▼]                                      │
│ Applied automatically to new services           │
└─────────────────────────────────────────────────┘
```

### Service Creation/Edit

**New Fields:**
```
┌─────────────────────────────────────────────────┐
│ Service Type                                    │
│ [Dental ▼]  (pre-filled from client default)    │
│                                                 │
│ ☐ Time-specific delivery                        │
│   Time: [10:30]  (if checked)                   │
│                                                 │
│ Zone: 🟢 In Zone (Porto)  [auto-detected]       │
│   or                                            │
│ Zone: 🔴 Out of Zone (Aveiro) - +€0.50/km       │
│   Tolls: [€2.50]                                │
└─────────────────────────────────────────────────┘
```

### Service Detail / Card

**Price Breakdown:**
```
┌─────────────────────────────────────────────────┐
│ Price Breakdown                                 │
├─────────────────────────────────────────────────┤
│ Service Type: Dental                            │
│ Base Price: €13.00 (out-of-zone)                │
│ Distance: 25km × €0.50 = €12.50                 │
│ Tolls: €2.50                                    │
│ ─────────────────────────────────               │
│ Total: €28.00 + IVA                             │
└─────────────────────────────────────────────────┘
```

---

## Municipality Detection

### Approach
Use Mapbox Geocoding API response to extract municipality:

```typescript
// Mapbox returns place context with locality/place information
// Example response context:
// - locality: "Paranhos"
// - place: "Porto"  <-- This is the municipality
// - region: "Porto"
// - country: "Portugal"

async function detectMunicipality(address: string): Promise<string | null> {
  const geocodeResult = await mapboxGeocode(address);

  // Extract "place" from context (municipality level)
  const placeContext = geocodeResult.context?.find(
    c => c.id.startsWith('place.')
  );

  return placeContext?.text || null;
}
```

### Fallback
If auto-detection fails:
1. Show warning to user
2. Allow manual selection of in-zone / out-of-zone
3. Store detected_municipality as null

---

## Migration Strategy

### Phase 1: Add New Tables (Non-Breaking)
1. Create `service_types` table
2. Create `distribution_zones` table
3. Add new columns to `profiles` and `services`
4. All new columns nullable or with defaults

### Phase 2: UI for Type-Based Pricing
1. Add Service Types management in settings
2. Add Distribution Zones management in settings
3. Add Special Pricing settings

### Phase 3: Client & Service Integration
1. Add default_service_type_id to client creation/edit
2. Add service_type_id, is_time_specific, is_out_of_zone, tolls to service forms
3. Add municipality detection on address selection

### Phase 4: Pricing Calculation
1. Implement type-based price calculation
2. Add pricing_system toggle (global + per-client)
3. Update price display in UI

---

## Relationship to Other Features

### Service Details Enhancements (Same Session)
See: `docs/plans/2025-01-29-service-details-enhancements.md`

Features designed in same session:
- Display IDs (#25-0142 format)
- Recipient name/phone fields
- Customer reference field
- Printable labels with QR codes
- Label branding settings

### Print Labels
Labels will show:
- Service type name (for categorization)
- Price (if enabled)
- In-zone / Out-of-zone indicator

---

## Open Questions

1. **Portuguese municipalities data source** - Need a complete list of concelhos with codes
2. **Mapbox place detection accuracy** - Need to test with Portuguese addresses
3. **Time-specific trigger** - Is it when `scheduled_time` is set, or explicit checkbox?
4. **Combining time-specific + out-of-zone** - Is it €13 + km + tolls, or different?

---

## Implementation Order

```
1. Database Migration
   ├── Create service_types table
   ├── Create distribution_zones table
   ├── Add columns to profiles
   └── Add columns to services

2. Service Types Management (Settings)
   ├── CRUD for service types
   └── Special pricing settings

3. Distribution Zones Management (Settings)
   ├── List of Portuguese municipalities
   └── Selection UI

4. Client Default Type
   ├── Add to client creation form
   └── Add to client edit form

5. Service Form Updates
   ├── Service type selector
   ├── Time-specific checkbox + time input
   ├── Zone detection from address
   └── Tolls input (conditional)

6. Price Calculation
   ├── Type-based calculation logic
   ├── Integration with existing system
   └── Price breakdown display

7. Testing
   ├── Normal in-zone pricing
   ├── Time-specific pricing
   ├── Out-of-zone pricing with km + tolls
   └── Municipality detection
```

---

## Files to Create/Modify

### New Files
- `supabase/migrations/XXXXXX_add_service_types.sql`
- `src/lib/services/type-pricing.ts`
- `src/lib/components/ServiceTypeSelect.svelte`
- `src/lib/components/ZoneSelector.svelte`
- `src/routes/courier/settings/ServiceTypesTab.svelte`
- `src/routes/courier/settings/ZonesTab.svelte`

### Modified Files
- `src/lib/database.types.ts`
- `src/lib/services/pricing.ts` (add type-based calculation)
- `src/routes/courier/settings/+page.svelte` (add tabs)
- `src/routes/courier/settings/+page.server.ts` (add actions)
- `src/routes/courier/clients/[id]/edit/+page.svelte` (add default type)
- `src/routes/courier/services/new/+page.svelte` (add type fields)
- `src/routes/courier/services/[id]/edit/+page.svelte` (add type fields)
- `src/routes/client/new/+page.svelte` (add type selection if allowed)

---

## References

- WhatsApp chat: `/Users/filipegarrido/Downloads/_chat 3.txt`
- Current pricing implementation: `src/lib/services/pricing.ts`
- Current database types: `src/lib/database.types.ts`
- Service details design: `docs/plans/2025-01-29-service-details-enhancements.md`
