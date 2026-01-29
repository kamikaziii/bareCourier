# Pricing Model Redesign - Design Document

**Date:** 2025-01-29
**Status:** Approved
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
| Any time preference | **€13 flat** (replaces base type) |
| Out-of-zone | **€13 + €0.50/km + tolls** |

**Key Differences:**
1. Price determined by SERVICE TYPE, not distance
2. Zones are GEOGRAPHIC (municipalities), not distance brackets
3. Time preference and out-of-zone use fixed €13 base (type doesn't matter)
4. Tolls are manual entry (exact amount)
5. Urgency fees are redundant (time preference already triggers premium)

---

## Confirmed Pricing Logic

### Time Preference Definition
**Time preference = ANY time slot selection**, including:
- Manhã (8h - 12h)
- Tarde (12h - 18h)
- Noite (18h - 21h)
- Hora específica (exact time)

When type-based pricing is enabled, selecting ANY of these triggers the €13 price. The default is date-only (no time preference) which uses the base type price.

### Scenario Matrix

| Scenario | Price |
|----------|-------|
| In-zone, date only | Type price (€4 dental, €3 optical) |
| In-zone, any time slot | €13 flat |
| Out-of-zone, any | €13 + €0.50/km + tolls |
| Out-of-zone + time slot | €13 + €0.50/km + tolls (same) |

**Rules:**
1. Base type price ONLY applies to normal in-zone deliveries WITHOUT time preference
2. Any time slot = €13 flat (type doesn't affect price)
3. Out-of-zone = €13 + distance fee + tolls (type doesn't affect price)
4. "Serviço Especial" (€13) is the base for both time preference AND out-of-zone
5. Time preference + out-of-zone = same as out-of-zone (no double €13)

---

## Design Decisions

### Q1: Replace or keep current pricing system?
**Decision:** Keep both systems
- Add type-based pricing alongside existing distance-based models
- Courier selects mode in settings: `distance` or `type`

### Q2: Who manages service types?
**Decision:** Courier only
- Courier creates/edits/deletes types in settings
- Types are global (same types available for all clients)
- Client has a default type assigned

### Q3: How to define distribution zones?
**Decision:** Grouped checkbox list with search
- Full list of 308 Portuguese municipalities (concelhos)
- Grouped by 18 distritos for easier navigation
- Courier checks boxes to mark "in zone"
- Search filter for quick lookup

### Q4: How to detect in-zone vs out-of-zone?
**Decision:** Auto-detect from delivery address
- Extract municipality from Mapbox geocoding response
- Match against courier's zone list
- Show indicator with manual override if detection fails

### Q5: How to trigger time-specific pricing?
**Decision:** Adapt scheduling UI
- Default: date only (base type price)
- Optional expansion: "+ Adicionar preferência de horário"
- Selecting any time slot triggers €13 premium
- Show price feedback when time preference is added

### Q6: What about urgency fees?
**Decision:** Hide when type-based pricing is active
- Urgency is redundant (time preference already = premium)
- Keep urgency fees for distance-based mode only

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

-- RLS: Courier can manage, clients can read active types
```

### New Table: `distribution_zones`

```sql
CREATE TABLE distribution_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distrito text NOT NULL,                -- "Porto", "Braga", etc.
  concelho text NOT NULL,                -- "Maia", "Matosinhos", etc.
  created_at timestamptz DEFAULT now()
);

-- RLS: Courier only (single courier system)
```

### Updates to `profiles`

```sql
-- Pricing mode: 'distance' (current) or 'type' (new)
ALTER TABLE profiles ADD COLUMN
  pricing_mode text DEFAULT 'distance'
    CHECK (pricing_mode IN ('distance', 'type'));

-- Type-based pricing settings (courier only)
ALTER TABLE profiles ADD COLUMN time_specific_price numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN out_of_zone_base numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN out_of_zone_per_km numeric(10,2) DEFAULT 0.50;

-- Client default service type
ALTER TABLE profiles ADD COLUMN default_service_type_id uuid REFERENCES service_types(id);
```

### Updates to `services`

```sql
ALTER TABLE services ADD COLUMN service_type_id uuid REFERENCES service_types(id);
ALTER TABLE services ADD COLUMN has_time_preference boolean DEFAULT false;
ALTER TABLE services ADD COLUMN is_out_of_zone boolean DEFAULT false;
ALTER TABLE services ADD COLUMN detected_municipality text;  -- Auto-detected from address
ALTER TABLE services ADD COLUMN tolls numeric(10,2) DEFAULT 0;
```

---

## Price Calculation Logic

```typescript
interface TypeBasedPriceInput {
  serviceTypeId: string;
  hasTimePreference: boolean;
  isOutOfZone: boolean;
  distanceKm: number | null;
  tolls: number;
}

interface CourierSettings {
  timeSpecificPrice: number;      // Default: 13.00
  outOfZoneBase: number;          // Default: 13.00
  outOfZonePerKm: number;         // Default: 0.50
}

function calculateTypeBasedPrice(
  input: TypeBasedPriceInput,
  settings: CourierSettings,
  serviceType: ServiceType
): number {
  // Rule 1: Out-of-zone = base + km + tolls (takes precedence)
  if (input.isOutOfZone) {
    const kmFee = (input.distanceKm || 0) * settings.outOfZonePerKm;
    return settings.outOfZoneBase + kmFee + input.tolls;
  }

  // Rule 2: Time preference = fixed price (replaces base)
  if (input.hasTimePreference) {
    return settings.timeSpecificPrice;
  }

  // Rule 3: Normal in-zone = type price
  return serviceType.price;
}
```

---

## UI Designs

### 1. Scheduling UI (When Type-Based Pricing Enabled)

**Default state (date only):**
```
┌─────────────────────────────────────────────────────────┐
│ Agendamento                                             │
├─────────────────────────────────────────────────────────┤
│ Data: [29 Jan 2025 ▼]                                   │
│                                                         │
│ [+ Adicionar preferência de horário]                    │
│                                                         │
│ Preço: €4.00 (Dental)                                   │
└─────────────────────────────────────────────────────────┘
```

**Expanded state (time preference selected):**
```
┌─────────────────────────────────────────────────────────┐
│ Agendamento                                             │
├─────────────────────────────────────────────────────────┤
│ Data: [29 Jan 2025 ▼]                                   │
│                                                         │
│ Preferência de horário:                      [Remover]  │
│ [Manhã] [Tarde] [Noite] [Hora específica]               │
│                                                         │
│ ⚠️ +€9.00 pela preferência de horário                   │
│ Preço: €13.00                                           │
└─────────────────────────────────────────────────────────┘
```

**Note:** Price display respects `show_price_to_client` / `show_price_to_courier` settings.

### 2. Distribution Zones Management

```
┌─────────────────────────────────────────────────────────┐
│ Zonas de Distribuição                     [Guardar]     │
├─────────────────────────────────────────────────────────┤
│ [🔍 Pesquisar concelho...                          ]    │
│                                                         │
│ ▼ Porto (distrito)                          [☑ Todos]  │
│   ☑ Porto                                              │
│   ☑ Maia                                               │
│   ☑ Matosinhos                                         │
│   ☑ Gondomar                                           │
│   ☐ Vila Nova de Gaia                                  │
│   ☐ Valongo                                            │
│   ...                                                  │
│                                                         │
│ ▶ Braga (distrito)                                     │
│ ▶ Aveiro (distrito)                                    │
│ ... (18 distritos total)                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Selecionados (4): Porto, Maia, Matosinhos, Gondomar    │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Grouped by distrito (18 groups) - reduces 308 items to manageable chunks
- District-level "select all" checkbox
- Search filter to find specific concelho
- Summary footer showing current selections
- Auto-expand Porto district (smart default)

**Data source:** Static JSON with 308 concelhos from GeoAPI.pt or INE

### 3. Service Types Management

```
┌─────────────────────────────────────────────────────────┐
│ Tipos de Serviço                          [+ Adicionar] │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Dental                                    €4.00     │ │
│ │ Material dentário                    [✏️] [🗑️]     │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Óptica                                    €3.00     │ │
│ │ Material ótico                       [✏️] [🗑️]     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Add/Edit form:
┌─────────────────────────────────────────────────────────┐
│ Novo Tipo de Serviço                                    │
├─────────────────────────────────────────────────────────┤
│ Nome:        [Dental                              ]     │
│ Preço:       [€ 4.00                              ]     │
│ Descrição:   [Material dentário (opcional)        ]     │
│                                                         │
│                         [Cancelar]  [Guardar]           │
└─────────────────────────────────────────────────────────┘
```

### 4. Client Default Service Type

```
┌─────────────────────────────────────────────────────────┐
│ Novo Cliente                                            │
├─────────────────────────────────────────────────────────┤
│ Nome:           [Laboratório ABC                   ]    │
│ Email:          [lab@example.com                   ]    │
│ Telefone:       [+351 912 345 678                  ]    │
│ Morada padrão:  [Rua da Saúde 123, Porto           ]    │
│                                                         │
│ ─────────────── Faturação ───────────────               │
│                                                         │
│ Tipo de serviço padrão:                                 │
│ [Dental ▼]                                              │
│ Aplicado automaticamente a novos serviços               │
└─────────────────────────────────────────────────────────┘
```

**Note:** Only visible when type-based pricing is enabled.

### 5. Service Form (Courier)

```
┌─────────────────────────────────────────────────────────┐
│ Novo Serviço                                            │
├─────────────────────────────────────────────────────────┤
│ Cliente: [Laboratório ABC ▼]                            │
│                                                         │
│ ─────────────── Localizações ───────────────            │
│ Recolha:  [Farmácia Central, Av. República 123...]      │
│ Entrega:  [Rua da Saúde 456, Aveiro             ]       │
│           🔴 Fora de zona (Aveiro)                      │
│                                                         │
│ ─────────────── Tipo de Serviço ───────────────         │
│ [Dental ▼]  (pré-preenchido do cliente)                 │
│                                                         │
│ ─────────────── Agendamento ───────────────             │
│ Data: [29 Jan 2025 ▼]                                   │
│ [+ Adicionar preferência de horário]                    │
│                                                         │
│ ─────────────── Fora de Zona ───────────────            │
│ (aparece apenas se destino fora de zona)                │
│                                                         │
│ Distância estimada: 45 km                               │
│ Portagens:  [€ 2.50        ]                            │
│                                                         │
│ ─────────────── Preço ───────────────                   │
│ Base (fora de zona):     €13.00                         │
│ Distância (45km × €0.50): €22.50                        │
│ Portagens:                €2.50                         │
│ ───────────────────────────────                         │
│ Total:                   €38.00                         │
│                                                         │
│                              [Cancelar]  [Criar]        │
└─────────────────────────────────────────────────────────┘
```

### 6. Service Form (Client)

```
┌─────────────────────────────────────────────────────────┐
│ Pedir Novo Serviço                                      │
├─────────────────────────────────────────────────────────┤
│ ─────────────── Localizações ───────────────            │
│ Recolha:  [Usar morada padrão ✓]                        │
│           Farmácia Central, Av. República 123, Porto    │
│                                                         │
│ Entrega:  [Rua da Saúde 456, Aveiro             ]       │
│           🔴 Fora da zona de distribuição               │
│           Pode haver custos adicionais                  │
│                                                         │
│ ─────────────── Agendamento ───────────────             │
│ Data: [29 Jan 2025 ▼]                                   │
│                                                         │
│ [+ Adicionar preferência de horário]                    │
│   ⚠️ Serviços com horário têm custo adicional           │
│                                                         │
│ ─────────────── Notas ───────────────                   │
│ [Entregar na receção antes das 10h          ]           │
│                                                         │
│ ─────────────── Resumo ───────────────                  │
│ (se show_price_to_client = true)                        │
│                                                         │
│ Tipo: Dental                                            │
│ Preço estimado: €13.00 + custos de distância            │
│ (preço final confirmado pelo estafeta)                  │
│                                                         │
│                              [Cancelar]  [Pedir]        │
└─────────────────────────────────────────────────────────┘
```

**Differences from courier form:**

| Aspect | Courier | Client |
|--------|---------|--------|
| Service type | Dropdown (can change) | Hidden (uses their default) |
| Zone indicator | Technical (municipality name) | Friendly ("fora da zona") |
| Tolls input | Yes (enters exact amount) | No (courier adds later) |
| Price breakdown | Full detail | Simplified estimate |
| Distance km | Shown | Hidden |

### 7. Pricing Mode Switch

```
┌─────────────────────────────────────────────────────────┐
│ Modo de Preços                                          │
├─────────────────────────────────────────────────────────┤
│ Como calcular o preço dos serviços?                     │
│                                                         │
│ ○ Baseado em distância                                  │
│   Preço calculado por km (armazém ou zona)              │
│   • Armazém: distância do armazém ao destino            │
│   • Zona: faixas de preço por km                        │
│                                                         │
│ ● Baseado em tipo de serviço              [Recomendado] │
│   Preço fixo por tipo (Dental, Óptica, etc.)            │
│   • Dentro de zona: preço do tipo                       │
│   • Com horário: €13.00 fixo                            │
│   • Fora de zona: €13.00 + €0.50/km + portagens         │
│                                                         │
│                                           [Guardar]     │
└─────────────────────────────────────────────────────────┘
```

**When type-based is selected, show additional settings:**

```
┌─────────────────────────────────────────────────────────┐
│ Preços Especiais                                        │
├─────────────────────────────────────────────────────────┤
│ Serviço com horário (manhã/tarde/noite/específico):     │
│ [€ 13.00        ]                                       │
│                                                         │
│ Fora de zona - preço base:                              │
│ [€ 13.00        ]                                       │
│                                                         │
│ Fora de zona - por km:                                  │
│ [€ 0.50         ]                                       │
│                                                         │
│                                           [Guardar]     │
└─────────────────────────────────────────────────────────┘
```

**Conditional UI when type-based is active:**
- Show: "Service Types" and "Distribution Zones" sections
- Hide: Urgency fees (redundant for this model)
- Show: Special pricing settings

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

function extractMunicipality(geocodeResult: MapboxFeature): string | null {
  const placeContext = geocodeResult.context?.find(
    c => c.id.startsWith('place.')
  );
  return placeContext?.text || null;
}

function checkIsOutOfZone(
  municipality: string | null,
  courierZones: string[]
): boolean {
  if (!municipality) return true; // Unknown = out of zone (safer)
  return !courierZones.includes(municipality);
}
```

### Fallback
If auto-detection fails:
1. Show warning: "Não foi possível determinar o concelho"
2. Allow manual toggle: in-zone / out-of-zone
3. Store `detected_municipality` as null

---

## Migration Strategy

### Phase 1: Database (Non-Breaking)
1. Create `service_types` table
2. Create `distribution_zones` table
3. Add new columns to `profiles` (all with defaults)
4. Add new columns to `services` (all nullable or with defaults)

### Phase 2: Settings UI
1. Add pricing mode switch
2. Add Service Types management section
3. Add Distribution Zones management section
4. Add Special Pricing settings
5. Conditionally hide urgency fees when type-based

### Phase 3: Client Integration
1. Add `default_service_type_id` to client creation form
2. Add `default_service_type_id` to client edit form
3. Only show when type-based pricing is enabled

### Phase 4: Service Forms
1. Add service type selector (courier form)
2. Update scheduling UI (date only default, time preference expansion)
3. Add zone auto-detection from address
4. Add tolls input (courier form, conditional)
5. Add zone indicator (both forms)
6. Update client form (simplified version)

### Phase 5: Price Calculation
1. Implement `calculateTypeBasedPrice()` function
2. Integrate with existing pricing system
3. Update price display components
4. Respect visibility settings

---

## Files to Create/Modify

### New Files
- `supabase/migrations/XXXXXX_add_type_based_pricing.sql`
- `src/lib/services/type-pricing.ts`
- `src/lib/data/portugal-municipalities.json`
- `src/lib/components/ServiceTypeSelect.svelte`
- `src/lib/components/DistributionZonesSelector.svelte`
- `src/lib/components/TimePreferencePicker.svelte`
- `src/routes/courier/settings/ServiceTypesSection.svelte`
- `src/routes/courier/settings/DistributionZonesSection.svelte`
- `src/routes/courier/settings/SpecialPricingSection.svelte`

### Modified Files
- `src/lib/database.types.ts` (regenerate)
- `src/lib/services/pricing.ts` (add type-based calculation)
- `src/routes/courier/settings/+page.svelte` (add sections)
- `src/routes/courier/settings/+page.server.ts` (add actions)
- `src/routes/courier/settings/PricingTab.svelte` (add mode switch)
- `src/routes/courier/clients/new/+page.svelte` (add default type)
- `src/routes/courier/clients/[id]/edit/+page.svelte` (add default type)
- `src/routes/courier/services/new/+page.svelte` (add type fields, scheduling)
- `src/routes/courier/services/[id]/edit/+page.svelte` (add type fields)
- `src/routes/client/new/+page.svelte` (update scheduling, zone indicator)
- `src/lib/components/SchedulePicker.svelte` (conditional mode)

---

## i18n Keys

New translation keys needed:

```typescript
// Pricing mode
pricing_mode_type: "Baseado em tipo de serviço",
pricing_mode_type_desc: "Preço fixo por tipo (Dental, Óptica, etc.)",

// Service types
service_types: "Tipos de Serviço",
service_type: "Tipo de Serviço",
add_service_type: "Adicionar Tipo",
edit_service_type: "Editar Tipo",
delete_service_type: "Eliminar Tipo",
delete_service_type_confirm: "Tem a certeza? Serviços existentes manterão o tipo.",

// Distribution zones
distribution_zones: "Zonas de Distribuição",
search_municipality: "Pesquisar concelho...",
selected_zones: "Selecionados",
select_all: "Todos",
in_zone: "Dentro de zona",
out_of_zone: "Fora de zona",
out_of_zone_warning: "Fora da zona de distribuição",
out_of_zone_client_warning: "Pode haver custos adicionais",

// Special pricing
special_pricing: "Preços Especiais",
time_specific_price: "Serviço com horário",
out_of_zone_base: "Fora de zona - preço base",
out_of_zone_per_km: "Fora de zona - por km",

// Scheduling
add_time_preference: "Adicionar preferência de horário",
remove_time_preference: "Remover",
time_preference_warning: "Serviços com horário têm custo adicional",
time_preference_surcharge: "+{amount} pela preferência de horário",

// Tolls
tolls: "Portagens",
estimated_distance: "Distância estimada",

// Client form
default_service_type: "Tipo de serviço padrão",
default_service_type_desc: "Aplicado automaticamente a novos serviços",
price_estimate: "Preço estimado",
price_final_note: "Preço final confirmado pelo estafeta",
```

---

## Testing Checklist

- [ ] Pricing mode switch works (distance ↔ type)
- [ ] Service types CRUD works
- [ ] Distribution zones selection works
- [ ] Zone auto-detection from Mapbox works
- [ ] Zone indicator shows correctly
- [ ] Time preference triggers €13 price
- [ ] Out-of-zone calculates correctly (base + km + tolls)
- [ ] Client default type is pre-filled in service form
- [ ] Tolls input appears only when out-of-zone
- [ ] Price visibility respects settings
- [ ] Urgency fees hidden when type-based mode
- [ ] Client form shows simplified version
- [ ] Existing services unaffected by mode switch
- [ ] All new strings translated (PT + EN)

---

## References

- WhatsApp chat: `/Users/filipegarrido/Downloads/_chat 3.txt`
- Current pricing implementation: `src/lib/services/pricing.ts`
- Current database types: `src/lib/database.types.ts`
- Service details design: `docs/plans/2025-01-29-service-details-enhancements.md`
- Zone selection UX research: Uber Eats, Route4Me, Onfleet patterns
- Portugal municipalities data: GeoAPI.pt, INE
