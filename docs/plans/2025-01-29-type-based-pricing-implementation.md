# Type-Based Pricing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add type-based pricing system where prices are determined by service type (Dental €4, Óptica €3) with geographic zones (municipalities) instead of distance.

**Architecture:** New `service_types` and `distribution_zones` tables. Courier settings gets pricing mode switch. Service forms adapt based on mode. Price calculation checks mode and applies appropriate logic.

**Tech Stack:** SvelteKit, Svelte 5, Supabase, shadcn-svelte, Tailwind CSS v4

---

## Phase 1: Database Schema

### Task 1: Create service_types table [COMPLETED]

**Files:**
- Created: `supabase/migrations/20260129130000_add_service_types_table.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add service_types table for type-based pricing
-- Allows courier to define service types (Dental, Óptica, etc.) with fixed prices

CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  description text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: Courier can manage, clients can read active types
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- Courier can do anything
CREATE POLICY "service_types_courier_all" ON service_types
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = (SELECT auth.uid())) = 'courier');

-- Clients can read active types
CREATE POLICY "service_types_client_select" ON service_types
  FOR SELECT
  USING (active = true);

-- Index for ordering
CREATE INDEX idx_service_types_sort ON service_types(sort_order, name);

COMMENT ON TABLE service_types IS 'Service types for type-based pricing (Dental, Óptica, etc.)';
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000001_add_service_types_table.sql
git commit -m "feat(db): add service_types table for type-based pricing"
```

---

### Task 2: Create distribution_zones table [COMPLETED]

**Files:**
- Created: `supabase/migrations/20260129130001_add_distribution_zones_table.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add distribution_zones table for geographic zone pricing
-- Stores municipalities (concelhos) that are "in zone" for the courier

CREATE TABLE distribution_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distrito text NOT NULL,
  concelho text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(distrito, concelho)
);

-- RLS: Courier only
ALTER TABLE distribution_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distribution_zones_courier_all" ON distribution_zones
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = (SELECT auth.uid())) = 'courier');

-- Index for lookups
CREATE INDEX idx_distribution_zones_concelho ON distribution_zones(concelho);
CREATE INDEX idx_distribution_zones_distrito ON distribution_zones(distrito);

COMMENT ON TABLE distribution_zones IS 'Geographic zones (municipalities) for type-based pricing';
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000002_add_distribution_zones_table.sql
git commit -m "feat(db): add distribution_zones table for geographic pricing"
```

---

### Task 3: Add type-based pricing columns to profiles [COMPLETED]

**Files:**
- Created: `supabase/migrations/20260129130002_add_type_pricing_profile_columns.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add type-based pricing columns to profiles
-- Courier settings for type-based pricing mode

-- Add pricing_mode column (update existing constraint if needed)
DO $$
BEGIN
  -- Check if pricing_mode already exists
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'profiles' AND column_name = 'pricing_mode') THEN
    -- Update the constraint to include 'type'
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pricing_mode_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_pricing_mode_check
      CHECK (pricing_mode IN ('warehouse', 'zone', 'type'));
  ELSE
    -- Add the column fresh
    ALTER TABLE profiles ADD COLUMN pricing_mode text DEFAULT 'warehouse'
      CHECK (pricing_mode IN ('warehouse', 'zone', 'type'));
  END IF;
END $$;

-- Type-based pricing settings (courier only)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS time_specific_price numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS out_of_zone_base numeric(10,2) DEFAULT 13.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS out_of_zone_per_km numeric(10,2) DEFAULT 0.50;

-- Client default service type
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.pricing_mode IS 'Pricing mode: warehouse, zone (distance-based) or type (type-based)';
COMMENT ON COLUMN profiles.time_specific_price IS 'Fixed price for services with time preference (type-based mode)';
COMMENT ON COLUMN profiles.out_of_zone_base IS 'Base price for out-of-zone services (type-based mode)';
COMMENT ON COLUMN profiles.out_of_zone_per_km IS 'Per-km rate for out-of-zone services (type-based mode)';
COMMENT ON COLUMN profiles.default_service_type_id IS 'Client default service type for new services';
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000003_add_type_pricing_profile_columns.sql
git commit -m "feat(db): add type-based pricing columns to profiles"
```

---

### Task 4: Add type-based pricing columns to services

**Files:**
- Create: `supabase/migrations/20260129000004_add_type_pricing_service_columns.sql`

**Step 1: Write the migration**

```sql
-- Migration: Add type-based pricing columns to services
-- Track service type, time preference, zone status, and tolls

ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES service_types(id) ON DELETE SET NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS has_time_preference boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_out_of_zone boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS detected_municipality text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS tolls numeric(10,2) DEFAULT 0;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type_id);

COMMENT ON COLUMN services.service_type_id IS 'Service type for type-based pricing';
COMMENT ON COLUMN services.has_time_preference IS 'Whether client selected a time slot (triggers special pricing)';
COMMENT ON COLUMN services.is_out_of_zone IS 'Whether delivery is outside courier distribution zones';
COMMENT ON COLUMN services.detected_municipality IS 'Auto-detected municipality from delivery address';
COMMENT ON COLUMN services.tolls IS 'Toll costs for out-of-zone services';
```

**Step 2: Apply migration**

Run: `supabase db push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260129000004_add_type_pricing_service_columns.sql
git commit -m "feat(db): add type-based pricing columns to services"
```

---

### Task 5: Regenerate TypeScript types

**Files:**
- Modify: `src/lib/database.generated.ts` (auto-generated)
- Modify: `src/lib/database.types.ts`

**Step 1: Regenerate types from database**

Run: `pnpm run types:generate` (or `supabase gen types typescript --local > src/lib/database.generated.ts`)
Expected: New columns appear in generated types

**Step 2: Add convenience types to database.types.ts**

Add after line ~100 in `src/lib/database.types.ts`:

```typescript
// Service type for type-based pricing
export type ServiceType = GeneratedDatabase['public']['Tables']['service_types']['Row'];
export type NewServiceType = GeneratedDatabase['public']['Tables']['service_types']['Insert'];

// Distribution zone for geographic pricing
export type DistributionZone = GeneratedDatabase['public']['Tables']['distribution_zones']['Row'];
export type NewDistributionZone = GeneratedDatabase['public']['Tables']['distribution_zones']['Insert'];
```

**Step 3: Commit**

```bash
git add src/lib/database.generated.ts src/lib/database.types.ts
git commit -m "feat(types): regenerate types with type-based pricing columns"
```

---

## Phase 2: Portugal Municipalities Data

### Task 6: Create municipalities data file

**Files:**
- Create: `src/lib/data/portugal-municipalities.ts`

**Step 1: Create the data file with all 308 municipalities grouped by district**

```typescript
/**
 * Portugal municipalities (concelhos) grouped by district (distrito)
 * Source: INE (Instituto Nacional de Estatística)
 * Total: 308 municipalities across 18 continental districts + 2 autonomous regions
 */

export interface Municipality {
  concelho: string;
  distrito: string;
}

export interface DistritoGroup {
  distrito: string;
  concelhos: string[];
}

export const PORTUGAL_DISTRITOS: DistritoGroup[] = [
  {
    distrito: 'Aveiro',
    concelhos: [
      'Águeda', 'Albergaria-a-Velha', 'Anadia', 'Arouca', 'Aveiro',
      'Castelo de Paiva', 'Espinho', 'Estarreja', 'Ílhavo', 'Mealhada',
      'Murtosa', 'Oliveira de Azeméis', 'Oliveira do Bairro', 'Ovar',
      'Santa Maria da Feira', 'São João da Madeira', 'Sever do Vouga',
      'Vagos', 'Vale de Cambra'
    ]
  },
  {
    distrito: 'Beja',
    concelhos: [
      'Aljustrel', 'Almodôvar', 'Alvito', 'Barrancos', 'Beja', 'Castro Verde',
      'Cuba', 'Ferreira do Alentejo', 'Mértola', 'Moura', 'Odemira', 'Ourique',
      'Serpa', 'Vidigueira'
    ]
  },
  {
    distrito: 'Braga',
    concelhos: [
      'Amares', 'Barcelos', 'Braga', 'Cabeceiras de Basto', 'Celorico de Basto',
      'Esposende', 'Fafe', 'Guimarães', 'Póvoa de Lanhoso', 'Terras de Bouro',
      'Vieira do Minho', 'Vila Nova de Famalicão', 'Vila Verde', 'Vizela'
    ]
  },
  {
    distrito: 'Bragança',
    concelhos: [
      'Alfândega da Fé', 'Bragança', 'Carrazeda de Ansiães', 'Freixo de Espada à Cinta',
      'Macedo de Cavaleiros', 'Miranda do Douro', 'Mirandela', 'Mogadouro',
      'Torre de Moncorvo', 'Vila Flor', 'Vimioso', 'Vinhais'
    ]
  },
  {
    distrito: 'Castelo Branco',
    concelhos: [
      'Belmonte', 'Castelo Branco', 'Covilhã', 'Fundão', 'Idanha-a-Nova',
      'Oleiros', 'Penamacor', 'Proença-a-Nova', 'Sertã', 'Vila de Rei',
      'Vila Velha de Ródão'
    ]
  },
  {
    distrito: 'Coimbra',
    concelhos: [
      'Arganil', 'Cantanhede', 'Coimbra', 'Condeixa-a-Nova', 'Figueira da Foz',
      'Góis', 'Lousã', 'Mira', 'Miranda do Corvo', 'Montemor-o-Velho',
      'Oliveira do Hospital', 'Pampilhosa da Serra', 'Penacova', 'Penela',
      'Soure', 'Tábua', 'Vila Nova de Poiares'
    ]
  },
  {
    distrito: 'Évora',
    concelhos: [
      'Alandroal', 'Arraiolos', 'Borba', 'Estremoz', 'Évora', 'Montemor-o-Novo',
      'Mora', 'Mourão', 'Portel', 'Redondo', 'Reguengos de Monsaraz',
      'Vendas Novas', 'Viana do Alentejo', 'Vila Viçosa'
    ]
  },
  {
    distrito: 'Faro',
    concelhos: [
      'Albufeira', 'Alcoutim', 'Aljezur', 'Castro Marim', 'Faro', 'Lagoa',
      'Lagos', 'Loulé', 'Monchique', 'Olhão', 'Portimão', 'São Brás de Alportel',
      'Silves', 'Tavira', 'Vila do Bispo', 'Vila Real de Santo António'
    ]
  },
  {
    distrito: 'Guarda',
    concelhos: [
      'Aguiar da Beira', 'Almeida', 'Celorico da Beira', 'Figueira de Castelo Rodrigo',
      'Fornos de Algodres', 'Gouveia', 'Guarda', 'Manteigas', 'Mêda',
      'Pinhel', 'Sabugal', 'Seia', 'Trancoso', 'Vila Nova de Foz Côa'
    ]
  },
  {
    distrito: 'Leiria',
    concelhos: [
      'Alcobaça', 'Alvaiázere', 'Ansião', 'Batalha', 'Bombarral', 'Caldas da Rainha',
      'Castanheira de Pêra', 'Figueiró dos Vinhos', 'Leiria', 'Marinha Grande',
      'Nazaré', 'Óbidos', 'Pedrógão Grande', 'Peniche', 'Pombal', 'Porto de Mós'
    ]
  },
  {
    distrito: 'Lisboa',
    concelhos: [
      'Alenquer', 'Amadora', 'Arruda dos Vinhos', 'Azambuja', 'Cadaval',
      'Cascais', 'Lisboa', 'Loures', 'Lourinhã', 'Mafra', 'Odivelas',
      'Oeiras', 'Sintra', 'Sobral de Monte Agraço', 'Torres Vedras',
      'Vila Franca de Xira'
    ]
  },
  {
    distrito: 'Portalegre',
    concelhos: [
      'Alter do Chão', 'Arronches', 'Avis', 'Campo Maior', 'Castelo de Vide',
      'Crato', 'Elvas', 'Fronteira', 'Gavião', 'Marvão', 'Monforte',
      'Nisa', 'Ponte de Sor', 'Portalegre', 'Sousel'
    ]
  },
  {
    distrito: 'Porto',
    concelhos: [
      'Amarante', 'Baião', 'Felgueiras', 'Gondomar', 'Lousada', 'Maia',
      'Marco de Canaveses', 'Matosinhos', 'Paços de Ferreira', 'Paredes',
      'Penafiel', 'Porto', 'Póvoa de Varzim', 'Santo Tirso', 'Trofa',
      'Valongo', 'Vila do Conde', 'Vila Nova de Gaia'
    ]
  },
  {
    distrito: 'Santarém',
    concelhos: [
      'Abrantes', 'Alcanena', 'Almeirim', 'Alpiarça', 'Benavente', 'Cartaxo',
      'Chamusca', 'Constância', 'Coruche', 'Entroncamento', 'Ferreira do Zêzere',
      'Golegã', 'Mação', 'Ourém', 'Rio Maior', 'Salvaterra de Magos',
      'Santarém', 'Sardoal', 'Tomar', 'Torres Novas', 'Vila Nova da Barquinha'
    ]
  },
  {
    distrito: 'Setúbal',
    concelhos: [
      'Alcácer do Sal', 'Alcochete', 'Almada', 'Barreiro', 'Grândola',
      'Moita', 'Montijo', 'Palmela', 'Santiago do Cacém', 'Seixal',
      'Sesimbra', 'Setúbal', 'Sines'
    ]
  },
  {
    distrito: 'Viana do Castelo',
    concelhos: [
      'Arcos de Valdevez', 'Caminha', 'Melgaço', 'Monção', 'Paredes de Coura',
      'Ponte da Barca', 'Ponte de Lima', 'Valença', 'Viana do Castelo',
      'Vila Nova de Cerveira'
    ]
  },
  {
    distrito: 'Vila Real',
    concelhos: [
      'Alijó', 'Boticas', 'Chaves', 'Mesão Frio', 'Mondim de Basto',
      'Montalegre', 'Murça', 'Peso da Régua', 'Ribeira de Pena',
      'Sabrosa', 'Santa Marta de Penaguião', 'Valpaços', 'Vila Pouca de Aguiar',
      'Vila Real'
    ]
  },
  {
    distrito: 'Viseu',
    concelhos: [
      'Armamar', 'Carregal do Sal', 'Castro Daire', 'Cinfães', 'Lamego',
      'Mangualde', 'Moimenta da Beira', 'Mortágua', 'Nelas', 'Oliveira de Frades',
      'Penalva do Castelo', 'Penedono', 'Resende', 'Santa Comba Dão',
      'São João da Pesqueira', 'São Pedro do Sul', 'Sátão', 'Sernancelhe',
      'Tabuaço', 'Tarouca', 'Tondela', 'Vila Nova de Paiva', 'Viseu', 'Vouzela'
    ]
  }
];

/**
 * Flat list of all municipalities for search/lookup
 */
export const ALL_MUNICIPALITIES: Municipality[] = PORTUGAL_DISTRITOS.flatMap(d =>
  d.concelhos.map(c => ({ concelho: c, distrito: d.distrito }))
);

/**
 * Check if a municipality name is in the list (case-insensitive)
 */
export function findMunicipality(name: string): Municipality | undefined {
  const normalized = name.toLowerCase().trim();
  return ALL_MUNICIPALITIES.find(m => m.concelho.toLowerCase() === normalized);
}

/**
 * Search municipalities by partial name
 */
export function searchMunicipalities(query: string, limit = 10): Municipality[] {
  if (!query.trim()) return [];
  const normalized = query.toLowerCase().trim();
  return ALL_MUNICIPALITIES
    .filter(m => m.concelho.toLowerCase().includes(normalized))
    .slice(0, limit);
}
```

**Step 2: Verify the data compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/data/portugal-municipalities.ts
git commit -m "feat(data): add Portugal municipalities dataset for zone selection"
```

---

## Phase 3: Type-Based Pricing Logic

### Task 7: Create type-based pricing service

**Files:**
- Create: `src/lib/services/type-pricing.ts`

**Step 1: Write the pricing calculation logic**

```typescript
/**
 * Type-Based Pricing Service
 *
 * Calculates prices based on service type, time preference, and geographic zones.
 * Used when courier's pricing_mode is 'type'.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServiceType, DistributionZone } from '$lib/database.types';

export interface TypePricingSettings {
  timeSpecificPrice: number;
  outOfZoneBase: number;
  outOfZonePerKm: number;
}

export interface TypePricingInput {
  serviceTypeId: string | null;
  hasTimePreference: boolean;
  isOutOfZone: boolean;
  distanceKm: number | null;
  tolls: number;
}

export interface TypePriceBreakdown {
  base: number;
  distance: number;
  tolls: number;
  total: number;
  reason: 'type' | 'time_preference' | 'out_of_zone';
  serviceTypeName?: string;
}

export interface TypePriceResult {
  success: boolean;
  price: number | null;
  breakdown: TypePriceBreakdown | null;
  error?: string;
}

/**
 * Get courier's type-based pricing settings
 */
export async function getTypePricingSettings(
  supabase: SupabaseClient
): Promise<TypePricingSettings> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('time_specific_price, out_of_zone_base, out_of_zone_per_km')
    .eq('role', 'courier')
    .limit(1)
    .single();

  return {
    timeSpecificPrice: profile?.time_specific_price ?? 13.0,
    outOfZoneBase: profile?.out_of_zone_base ?? 13.0,
    outOfZonePerKm: profile?.out_of_zone_per_km ?? 0.5
  };
}

/**
 * Get all active service types
 */
export async function getServiceTypes(
  supabase: SupabaseClient
): Promise<ServiceType[]> {
  const { data } = await supabase
    .from('service_types')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  return (data || []) as ServiceType[];
}

/**
 * Get a single service type by ID
 */
export async function getServiceType(
  supabase: SupabaseClient,
  typeId: string
): Promise<ServiceType | null> {
  const { data } = await supabase
    .from('service_types')
    .select('*')
    .eq('id', typeId)
    .single();

  return data as ServiceType | null;
}

/**
 * Get all distribution zones
 */
export async function getDistributionZones(
  supabase: SupabaseClient
): Promise<DistributionZone[]> {
  const { data } = await supabase
    .from('distribution_zones')
    .select('*')
    .order('distrito, concelho');

  return (data || []) as DistributionZone[];
}

/**
 * Check if a municipality is in the courier's distribution zones
 */
export async function isInDistributionZone(
  supabase: SupabaseClient,
  municipality: string | null
): Promise<boolean> {
  if (!municipality) return false;

  const { count } = await supabase
    .from('distribution_zones')
    .select('id', { count: 'exact', head: true })
    .ilike('concelho', municipality);

  return (count || 0) > 0;
}

/**
 * Calculate type-based price
 *
 * Rules:
 * 1. Out-of-zone = base + km + tolls (takes precedence)
 * 2. Time preference = fixed price
 * 3. Normal in-zone = service type price
 */
export async function calculateTypedPrice(
  supabase: SupabaseClient,
  input: TypePricingInput
): Promise<TypePriceResult> {
  try {
    const settings = await getTypePricingSettings(supabase);

    // Rule 1: Out-of-zone = base + km + tolls
    if (input.isOutOfZone) {
      const kmFee = (input.distanceKm || 0) * settings.outOfZonePerKm;
      const total = settings.outOfZoneBase + kmFee + input.tolls;

      return {
        success: true,
        price: Math.round(total * 100) / 100,
        breakdown: {
          base: settings.outOfZoneBase,
          distance: Math.round(kmFee * 100) / 100,
          tolls: input.tolls,
          total: Math.round(total * 100) / 100,
          reason: 'out_of_zone'
        }
      };
    }

    // Rule 2: Time preference = fixed price
    if (input.hasTimePreference) {
      return {
        success: true,
        price: settings.timeSpecificPrice,
        breakdown: {
          base: settings.timeSpecificPrice,
          distance: 0,
          tolls: 0,
          total: settings.timeSpecificPrice,
          reason: 'time_preference'
        }
      };
    }

    // Rule 3: Normal in-zone = service type price
    if (!input.serviceTypeId) {
      return {
        success: false,
        price: null,
        breakdown: null,
        error: 'Service type is required for in-zone pricing'
      };
    }

    const serviceType = await getServiceType(supabase, input.serviceTypeId);
    if (!serviceType) {
      return {
        success: false,
        price: null,
        breakdown: null,
        error: 'Service type not found'
      };
    }

    return {
      success: true,
      price: Number(serviceType.price),
      breakdown: {
        base: Number(serviceType.price),
        distance: 0,
        tolls: 0,
        total: Number(serviceType.price),
        reason: 'type',
        serviceTypeName: serviceType.name
      }
    };
  } catch (error) {
    return {
      success: false,
      price: null,
      breakdown: null,
      error: (error as Error).message
    };
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/services/type-pricing.ts
git commit -m "feat(pricing): add type-based pricing calculation service"
```

---

## Phase 4: Settings UI - Service Types

### Task 8: Create ServiceTypesSection component

**Files:**
- Create: `src/routes/courier/settings/ServiceTypesSection.svelte`

**Step 1: Write the component**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Package, Plus, Pencil, Trash2 } from '@lucide/svelte';
	import type { ServiceType } from '$lib/database.types.js';

	interface Props {
		serviceTypes: ServiceType[];
	}

	let { serviceTypes }: Props = $props();

	let showNewForm = $state(false);
	let newType = $state({ name: '', price: '', description: '' });
	let editingTypeId = $state<string | null>(null);
	let deletingTypeId = $state<string | null>(null);
	let deleteDialogOpen = $state(false);

	function openDeleteDialog(typeId: string) {
		deletingTypeId = typeId;
		deleteDialogOpen = true;
	}

	function formatPrice(price: number | string): string {
		return Number(price).toFixed(2);
	}
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title class="flex items-center gap-2">
					<Package class="size-5" />
					{m.service_types()}
				</Card.Title>
				<Card.Description>{m.service_types_desc()}</Card.Description>
			</div>
			<Button variant="outline" onclick={() => (showNewForm = !showNewForm)}>
				<Plus class="mr-2 size-4" />
				{m.add_service_type()}
			</Button>
		</div>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if showNewForm}
			<form
				method="POST"
				action="?/createServiceType"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							showNewForm = false;
							newType = { name: '', price: '', description: '' };
						}
						await update();
					};
				}}
				class="space-y-4 rounded-lg border p-4"
			>
				<h4 class="font-medium">{m.new_service_type()}</h4>
				<div class="grid gap-4 md:grid-cols-3">
					<div class="space-y-2">
						<Label for="new_name">{m.form_name()}</Label>
						<Input id="new_name" name="name" bind:value={newType.name} required placeholder="Dental" />
					</div>
					<div class="space-y-2">
						<Label for="new_price">{m.price()}</Label>
						<Input
							id="new_price"
							name="price"
							type="number"
							step="0.01"
							min="0"
							bind:value={newType.price}
							required
							placeholder="4.00"
						/>
					</div>
					<div class="space-y-2">
						<Label for="new_desc">{m.settings_description()}</Label>
						<Input
							id="new_desc"
							name="description"
							bind:value={newType.description}
							placeholder={m.optional()}
						/>
					</div>
				</div>
				<div class="flex gap-2">
					<Button type="submit">{m.action_save()}</Button>
					<Button type="button" variant="outline" onclick={() => (showNewForm = false)}>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		{/if}

		<div class="space-y-3">
			{#each serviceTypes as type (type.id)}
				<div class="rounded-lg border p-4 {type.active ? '' : 'opacity-60'}">
					{#if editingTypeId === type.id}
						<form
							method="POST"
							action="?/updateServiceType"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										editingTypeId = null;
									}
									await update();
								};
							}}
						>
							<input type="hidden" name="id" value={type.id} />
							<div class="grid gap-4 md:grid-cols-3">
								<div class="space-y-2">
									<Label>{m.form_name()}</Label>
									<Input name="name" value={type.name} required />
								</div>
								<div class="space-y-2">
									<Label>{m.price()}</Label>
									<Input name="price" type="number" step="0.01" min="0" value={formatPrice(type.price)} />
								</div>
								<div class="space-y-2">
									<Label>{m.settings_description()}</Label>
									<Input name="description" value={type.description || ''} />
								</div>
							</div>
							<div class="mt-4 flex gap-2">
								<Button type="submit" size="sm">{m.action_save()}</Button>
								<Button type="button" variant="outline" size="sm" onclick={() => (editingTypeId = null)}>
									{m.action_cancel()}
								</Button>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between">
							<div>
								<h4 class="font-medium">{type.name}</h4>
								<p class="text-sm text-muted-foreground">{type.description || '-'}</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="mr-2 text-lg font-semibold">€{formatPrice(type.price)}</span>
								<Button variant="ghost" size="icon" onclick={() => (editingTypeId = type.id)}>
									<span class="sr-only">{m.action_edit()}</span>
									<Pencil class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive hover:text-destructive"
									onclick={() => openDeleteDialog(type.id)}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<p class="py-4 text-center text-muted-foreground">{m.no_service_types()}</p>
			{/each}
		</div>
	</Card.Content>
</Card.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.delete_service_type()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.delete_service_type_confirm()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteDialogOpen = false)}>
				{m.action_cancel()}
			</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/deleteServiceType"
				use:enhance={() => {
					return async ({ update }) => {
						deleteDialogOpen = false;
						deletingTypeId = null;
						await update();
					};
				}}
				class="inline"
			>
				<input type="hidden" name="id" value={deletingTypeId} />
				<AlertDialog.Action
					type="submit"
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					{m.action_delete()}
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
```

**Step 2: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors (may have missing i18n keys - that's OK for now)

**Step 3: Commit**

```bash
git add src/routes/courier/settings/ServiceTypesSection.svelte
git commit -m "feat(ui): add ServiceTypesSection component for type management"
```

---

### Task 9: Add service types server actions

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add load for service types**

In the `load` function, after loading urgencyFees, add:

```typescript
// Load service types
const { data: serviceTypes } = await supabase
  .from('service_types')
  .select('*')
  .order('sort_order');

return {
  profile: profile as Profile,
  urgencyFees: (urgencyFees || []) as UrgencyFee[],
  serviceTypes: (serviceTypes || []) as ServiceType[]
};
```

Add the import at the top:
```typescript
import type { Profile, UrgencyFee, PastDueSettings, WorkingDay, ServiceType } from '$lib/database.types';
```

**Step 2: Add actions for service types**

Add these actions to the `actions` object:

```typescript
createServiceType: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  await requireCourier(supabase, user.id);

  const formData = await request.formData();
  const name = formData.get('name') as string;
  const price = parseFloat(formData.get('price') as string) || 0;
  const description = formData.get('description') as string || null;

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('service_types')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sortOrder = ((maxOrder as { sort_order: number } | null)?.sort_order || 0) + 1;

  const { error } = await supabase.from('service_types').insert({
    name,
    price,
    description,
    sort_order: sortOrder
  });

  if (error) {
    return fail(500, { error: 'Failed to create service type' });
  }

  return { success: true, message: 'service_type_created' };
},

updateServiceType: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  await requireCourier(supabase, user.id);

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const price = parseFloat(formData.get('price') as string) || 0;
  const description = formData.get('description') as string || null;

  const { error } = await supabase
    .from('service_types')
    .update({ name, price, description, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return fail(500, { error: 'Failed to update service type' });
  }

  return { success: true, message: 'service_type_updated' };
},

deleteServiceType: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  await requireCourier(supabase, user.id);

  const formData = await request.formData();
  const id = formData.get('id') as string;

  // Check if this type is in use by any services
  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('service_type_id', id);

  if (count && count > 0) {
    return fail(409, { error: 'service_type_in_use' });
  }

  const { error } = await supabase.from('service_types').delete().eq('id', id);

  if (error) {
    return fail(500, { error: 'Failed to delete service type' });
  }

  return { success: true, message: 'service_type_deleted' };
},
```

**Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(api): add service types CRUD actions"
```

---

### Task 10: Add i18n keys for service types

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

Add to `messages/en.json`:

```json
"service_types": "Service Types",
"service_types_desc": "Define service types with fixed prices for type-based pricing",
"service_type": "Service Type",
"add_service_type": "Add Type",
"new_service_type": "New Service Type",
"edit_service_type": "Edit Type",
"delete_service_type": "Delete Service Type",
"delete_service_type_confirm": "Are you sure? Existing services will keep their type.",
"no_service_types": "No service types defined yet",
"price": "Price",
"optional": "Optional",
```

**Step 2: Add Portuguese keys**

Add to `messages/pt-PT.json`:

```json
"service_types": "Tipos de Serviço",
"service_types_desc": "Defina tipos de serviço com preços fixos para preços baseados em tipo",
"service_type": "Tipo de Serviço",
"add_service_type": "Adicionar Tipo",
"new_service_type": "Novo Tipo de Serviço",
"edit_service_type": "Editar Tipo",
"delete_service_type": "Eliminar Tipo de Serviço",
"delete_service_type_confirm": "Tem a certeza? Serviços existentes manterão o tipo.",
"no_service_types": "Ainda não há tipos de serviço definidos",
"price": "Preço",
"optional": "Opcional",
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add service types translations"
```

---

### Task 11: Integrate ServiceTypesSection into settings page

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`

**Step 1: Import the component**

Add import at the top:

```typescript
import ServiceTypesSection from './ServiceTypesSection.svelte';
```

**Step 2: Add the section to the page**

After the PricingTab component (or in the Pricing tab area), add:

```svelte
{#if data.profile.pricing_mode === 'type'}
  <ServiceTypesSection serviceTypes={data.serviceTypes} />
{/if}
```

**Step 3: Verify it renders**

Run: `pnpm run dev`
Navigate to `/courier/settings` and ensure the section appears when pricing mode is 'type'

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.svelte
git commit -m "feat(ui): integrate ServiceTypesSection into settings page"
```

---

## Phase 5: Settings UI - Distribution Zones

### Task 12: Create DistributionZonesSection component

**Files:**
- Create: `src/routes/courier/settings/DistributionZonesSection.svelte`

**Step 1: Write the component**

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { MapPin, ChevronDown, Search } from '@lucide/svelte';
	import { PORTUGAL_DISTRITOS } from '$lib/data/portugal-municipalities.js';
	import type { DistributionZone } from '$lib/database.types.js';

	interface Props {
		zones: DistributionZone[];
	}

	let { zones }: Props = $props();

	// Track selected zones as a Set for quick lookup
	let selectedZones = $state<Set<string>>(
		new Set(zones.map((z) => `${z.distrito}|${z.concelho}`))
	);

	// Track expanded distritos
	let expandedDistritos = $state<Set<string>>(new Set(['Porto'])); // Default expand Porto

	// Search filter
	let searchQuery = $state('');

	// Filtered distritos based on search
	const filteredDistritos = $derived(() => {
		if (!searchQuery.trim()) return PORTUGAL_DISTRITOS;
		const query = searchQuery.toLowerCase();
		return PORTUGAL_DISTRITOS.map((d) => ({
			...d,
			concelhos: d.concelhos.filter((c) => c.toLowerCase().includes(query))
		})).filter((d) => d.concelhos.length > 0);
	});

	// Count selected zones
	const selectedCount = $derived(selectedZones.size);

	// Check if a concelho is selected
	function isSelected(distrito: string, concelho: string): boolean {
		return selectedZones.has(`${distrito}|${concelho}`);
	}

	// Toggle a concelho
	function toggleConcelho(distrito: string, concelho: string) {
		const key = `${distrito}|${concelho}`;
		const newSet = new Set(selectedZones);
		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		selectedZones = newSet;
	}

	// Toggle all concelhos in a distrito
	function toggleDistrito(distrito: string, concelhos: string[]) {
		const allSelected = concelhos.every((c) => isSelected(distrito, c));
		const newSet = new Set(selectedZones);

		if (allSelected) {
			// Deselect all
			concelhos.forEach((c) => newSet.delete(`${distrito}|${c}`));
		} else {
			// Select all
			concelhos.forEach((c) => newSet.add(`${distrito}|${c}`));
		}
		selectedZones = newSet;
	}

	// Check if all concelhos in a distrito are selected
	function isDistritoFullySelected(distrito: string, concelhos: string[]): boolean {
		return concelhos.every((c) => isSelected(distrito, c));
	}

	// Check if some but not all concelhos are selected
	function isDistritoPartiallySelected(distrito: string, concelhos: string[]): boolean {
		const selected = concelhos.filter((c) => isSelected(distrito, c)).length;
		return selected > 0 && selected < concelhos.length;
	}

	// Toggle distrito expansion
	function toggleExpansion(distrito: string) {
		const newSet = new Set(expandedDistritos);
		if (newSet.has(distrito)) {
			newSet.delete(distrito);
		} else {
			newSet.add(distrito);
		}
		expandedDistritos = newSet;
	}

	// Build zones array for form submission
	const zonesForSubmit = $derived(
		Array.from(selectedZones).map((key) => {
			const [distrito, concelho] = key.split('|');
			return { distrito, concelho };
		})
	);

	let saving = $state(false);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<MapPin class="size-5" />
			{m.distribution_zones()}
		</Card.Title>
		<Card.Description>{m.distribution_zones_desc()}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-4">
		<form
			method="POST"
			action="?/updateDistributionZones"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					saving = false;
					await update();
				};
			}}
			class="space-y-4"
		>
			<!-- Search -->
			<div class="relative">
				<Search class="absolute left-3 top-3 size-4 text-muted-foreground" />
				<Input
					type="text"
					placeholder={m.search_municipality()}
					bind:value={searchQuery}
					class="pl-9"
				/>
			</div>

			<!-- Distritos list -->
			<div class="max-h-96 space-y-2 overflow-y-auto rounded-md border p-2">
				{#each filteredDistritos() as distrito (distrito.distrito)}
					<Collapsible.Root open={expandedDistritos.has(distrito.distrito)}>
						<div class="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50">
							<Checkbox
								checked={isDistritoFullySelected(distrito.distrito, distrito.concelhos)}
								indeterminate={isDistritoPartiallySelected(distrito.distrito, distrito.concelhos)}
								onCheckedChange={() => toggleDistrito(distrito.distrito, distrito.concelhos)}
							/>
							<Collapsible.Trigger
								class="flex flex-1 items-center justify-between"
								onclick={() => toggleExpansion(distrito.distrito)}
							>
								<span class="font-medium">{distrito.distrito}</span>
								<div class="flex items-center gap-2">
									<span class="text-sm text-muted-foreground">
										{distrito.concelhos.filter((c) => isSelected(distrito.distrito, c)).length}/{distrito.concelhos.length}
									</span>
									<ChevronDown
										class="size-4 transition-transform {expandedDistritos.has(distrito.distrito)
											? 'rotate-180'
											: ''}"
									/>
								</div>
							</Collapsible.Trigger>
						</div>
						<Collapsible.Content>
							<div class="ml-6 grid grid-cols-2 gap-1 py-2 md:grid-cols-3">
								{#each distrito.concelhos as concelho (concelho)}
									<label class="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-muted/50">
										<Checkbox
											checked={isSelected(distrito.distrito, concelho)}
											onCheckedChange={() => toggleConcelho(distrito.distrito, concelho)}
										/>
										<span class="text-sm">{concelho}</span>
									</label>
								{/each}
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				{:else}
					<p class="py-4 text-center text-muted-foreground">{m.no_results()}</p>
				{/each}
			</div>

			<!-- Hidden input with zones JSON -->
			<input type="hidden" name="zones" value={JSON.stringify(zonesForSubmit)} />

			<!-- Footer -->
			<div class="flex items-center justify-between">
				<Badge variant="secondary">
					{m.selected_zones()}: {selectedCount}
				</Badge>
				<Button type="submit" disabled={saving}>
					{saving ? m.saving() : m.action_save()}
				</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
```

**Step 2: Commit**

```bash
git add src/routes/courier/settings/DistributionZonesSection.svelte
git commit -m "feat(ui): add DistributionZonesSection component for zone management"
```

---

### Task 13: Add distribution zones server actions

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Add load for distribution zones**

In the `load` function, add:

```typescript
// Load distribution zones
const { data: distributionZones } = await supabase
  .from('distribution_zones')
  .select('*')
  .order('distrito, concelho');
```

Update the return:
```typescript
return {
  profile: profile as Profile,
  urgencyFees: (urgencyFees || []) as UrgencyFee[],
  serviceTypes: (serviceTypes || []) as ServiceType[],
  distributionZones: (distributionZones || []) as DistributionZone[]
};
```

Add import:
```typescript
import type { Profile, UrgencyFee, PastDueSettings, WorkingDay, ServiceType, DistributionZone } from '$lib/database.types';
```

**Step 2: Add action for updating zones**

```typescript
updateDistributionZones: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  await requireCourier(supabase, user.id);

  const formData = await request.formData();
  const zonesJson = formData.get('zones') as string;

  let zones: { distrito: string; concelho: string }[];
  try {
    zones = JSON.parse(zonesJson);
  } catch {
    return fail(400, { error: 'Invalid zones data' });
  }

  // Delete all existing zones and insert new ones (simpler than diffing)
  const { error: deleteError } = await supabase
    .from('distribution_zones')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

  if (deleteError) {
    return fail(500, { error: 'Failed to update zones' });
  }

  if (zones.length > 0) {
    const { error: insertError } = await supabase
      .from('distribution_zones')
      .insert(zones);

    if (insertError) {
      return fail(500, { error: 'Failed to save zones' });
    }
  }

  return { success: true, message: 'distribution_zones_updated' };
},
```

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(api): add distribution zones update action"
```

---

### Task 14: Add i18n keys for distribution zones

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

```json
"distribution_zones": "Distribution Zones",
"distribution_zones_desc": "Select municipalities that are within your distribution area",
"search_municipality": "Search municipality...",
"selected_zones": "Selected",
"in_zone": "In zone",
"out_of_zone": "Out of zone",
"out_of_zone_warning": "Outside distribution zone",
"out_of_zone_client_warning": "Additional costs may apply",
"no_results": "No results found",
```

**Step 2: Add Portuguese keys**

```json
"distribution_zones": "Zonas de Distribuição",
"distribution_zones_desc": "Selecione os municípios dentro da sua área de distribuição",
"search_municipality": "Pesquisar município...",
"selected_zones": "Selecionados",
"in_zone": "Dentro de zona",
"out_of_zone": "Fora de zona",
"out_of_zone_warning": "Fora da zona de distribuição",
"out_of_zone_client_warning": "Podem haver custos adicionais",
"no_results": "Sem resultados",
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add distribution zones translations"
```

---

### Task 15: Integrate DistributionZonesSection into settings page

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`

**Step 1: Import the component**

```typescript
import DistributionZonesSection from './DistributionZonesSection.svelte';
```

**Step 2: Add the section after ServiceTypesSection**

```svelte
{#if data.profile.pricing_mode === 'type'}
  <ServiceTypesSection serviceTypes={data.serviceTypes} />
  <DistributionZonesSection zones={data.distributionZones} />
{/if}
```

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.svelte
git commit -m "feat(ui): integrate DistributionZonesSection into settings page"
```

---

## Phase 6: Settings UI - Pricing Mode & Special Pricing

### Task 16: Update PricingTab with type-based mode option

**Files:**
- Modify: `src/routes/courier/settings/PricingTab.svelte`

**Step 1: Add 'type' option to pricing mode radio buttons**

After the existing "Zone" option (around line 100-120), add:

```svelte
<!-- Type-based Option -->
<label
  class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'type' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
>
  <input
    type="radio"
    name="pricing_mode"
    value="type"
    checked={pricingMode === 'type'}
    onchange={() => pricingMode = 'type'}
    class="mt-1"
  />
  <div class="flex-1">
    <div class="flex items-center gap-2">
      <Package class="size-4" />
      <span class="font-medium">{m.pricing_mode_type()}</span>
    </div>
    <p class="mt-1 text-sm text-muted-foreground">
      {m.pricing_mode_type_desc()}
    </p>
  </div>
</label>
```

Add import:
```typescript
import { Package } from '@lucide/svelte';
```

**Step 2: Add special pricing section for type-based mode**

After the pricing mode card, add a new card (conditionally shown):

```svelte
{#if pricingMode === 'type'}
  <!-- Special Pricing Settings -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Calculator class="size-5" />
        {m.special_pricing()}
      </Card.Title>
      <Card.Description>{m.special_pricing_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      <form method="POST" action="?/updateSpecialPricing" use:enhance class="space-y-4">
        <div class="grid gap-4 md:grid-cols-3">
          <div class="space-y-2">
            <Label for="time_specific_price">{m.time_specific_price()}</Label>
            <Input
              id="time_specific_price"
              name="time_specific_price"
              type="number"
              step="0.01"
              min="0"
              value={profile.time_specific_price ?? 13}
            />
            <p class="text-xs text-muted-foreground">{m.time_specific_price_desc()}</p>
          </div>
          <div class="space-y-2">
            <Label for="out_of_zone_base">{m.out_of_zone_base()}</Label>
            <Input
              id="out_of_zone_base"
              name="out_of_zone_base"
              type="number"
              step="0.01"
              min="0"
              value={profile.out_of_zone_base ?? 13}
            />
            <p class="text-xs text-muted-foreground">{m.out_of_zone_base_desc()}</p>
          </div>
          <div class="space-y-2">
            <Label for="out_of_zone_per_km">{m.out_of_zone_per_km()}</Label>
            <Input
              id="out_of_zone_per_km"
              name="out_of_zone_per_km"
              type="number"
              step="0.01"
              min="0"
              value={profile.out_of_zone_per_km ?? 0.5}
            />
            <p class="text-xs text-muted-foreground">{m.out_of_zone_per_km_desc()}</p>
          </div>
        </div>
        <Button type="submit">{m.action_save()}</Button>
      </form>
    </Card.Content>
  </Card.Root>
{/if}
```

**Step 3: Commit**

```bash
git add src/routes/courier/settings/PricingTab.svelte
git commit -m "feat(ui): add type-based pricing mode and special pricing settings"
```

---

### Task 17: Add special pricing server action

**Files:**
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Update updatePricingMode to accept 'type'**

Update the validation:
```typescript
if (!['warehouse', 'zone', 'type'].includes(pricingMode)) {
  return fail(400, { error: 'Invalid pricing mode' });
}
```

**Step 2: Add updateSpecialPricing action**

```typescript
updateSpecialPricing: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  await requireCourier(supabase, user.id);

  const formData = await request.formData();
  const timeSpecificPrice = parseFloat(formData.get('time_specific_price') as string) || 13;
  const outOfZoneBase = parseFloat(formData.get('out_of_zone_base') as string) || 13;
  const outOfZonePerKm = parseFloat(formData.get('out_of_zone_per_km') as string) || 0.5;

  const { error } = await supabase
    .from('profiles')
    .update({
      time_specific_price: timeSpecificPrice,
      out_of_zone_base: outOfZoneBase,
      out_of_zone_per_km: outOfZonePerKm
    })
    .eq('id', user.id);

  if (error) {
    return fail(500, { error: 'Failed to update special pricing' });
  }

  return { success: true, message: 'special_pricing_updated' };
},
```

**Step 3: Commit**

```bash
git add src/routes/courier/settings/+page.server.ts
git commit -m "feat(api): add special pricing update action"
```

---

### Task 18: Add i18n keys for pricing mode and special pricing

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

```json
"pricing_mode_type": "Type-based pricing",
"pricing_mode_type_desc": "Fixed price per service type (Dental, Optical, etc.)",
"special_pricing": "Special Pricing",
"special_pricing_desc": "Configure prices for time-specific and out-of-zone services",
"time_specific_price": "Time preference price",
"time_specific_price_desc": "Fixed price when client selects a time slot (morning, afternoon, etc.)",
"out_of_zone_base": "Out-of-zone base price",
"out_of_zone_base_desc": "Base price for deliveries outside your distribution zones",
"out_of_zone_per_km": "Out-of-zone per km",
"out_of_zone_per_km_desc": "Additional charge per kilometer for out-of-zone deliveries",
```

**Step 2: Add Portuguese keys**

```json
"pricing_mode_type": "Preço baseado em tipo",
"pricing_mode_type_desc": "Preço fixo por tipo de serviço (Dental, Óptica, etc.)",
"special_pricing": "Preços Especiais",
"special_pricing_desc": "Configure preços para serviços com horário e fora de zona",
"time_specific_price": "Preço com preferência de horário",
"time_specific_price_desc": "Preço fixo quando o cliente seleciona um horário (manhã, tarde, etc.)",
"out_of_zone_base": "Preço base fora de zona",
"out_of_zone_base_desc": "Preço base para entregas fora das suas zonas de distribuição",
"out_of_zone_per_km": "Fora de zona por km",
"out_of_zone_per_km_desc": "Custo adicional por quilómetro para entregas fora de zona",
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add pricing mode and special pricing translations"
```

---

## Phase 7: Client Default Service Type

### Task 19: Add default service type to client forms

**Files:**
- Modify: `src/routes/courier/clients/[id]/edit/+page.svelte`
- Modify: `src/routes/courier/clients/[id]/edit/+page.server.ts`

**Step 1: Load service types and pricing mode in server**

In the `load` function, add:

```typescript
// Get courier's pricing mode and service types
const { data: courier } = await supabase
  .from('profiles')
  .select('pricing_mode')
  .eq('role', 'courier')
  .single();

let serviceTypes: any[] = [];
if (courier?.pricing_mode === 'type') {
  const { data } = await supabase
    .from('service_types')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  serviceTypes = data || [];
}

return {
  client,
  pricing,
  zones,
  pricingMode: courier?.pricing_mode || 'warehouse',
  serviceTypes
};
```

**Step 2: Add service type dropdown to edit form**

In the form, add after the location field:

```svelte
{#if data.pricingMode === 'type' && data.serviceTypes.length > 0}
  <div class="space-y-2">
    <Label for="default_service_type_id">{m.default_service_type()}</Label>
    <select
      id="default_service_type_id"
      name="default_service_type_id"
      bind:value={defaultServiceTypeId}
      class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      disabled={loading}
    >
      <option value="">{m.none()}</option>
      {#each data.serviceTypes as type (type.id)}
        <option value={type.id}>{type.name} - €{Number(type.price).toFixed(2)}</option>
      {/each}
    </select>
    <p class="text-xs text-muted-foreground">{m.default_service_type_desc()}</p>
  </div>
{/if}
```

Add state variable:
```typescript
let defaultServiceTypeId = $state(data.client.default_service_type_id || '');
```

**Step 3: Handle in server action**

In the form action, extract and save:

```typescript
const defaultServiceTypeId = formData.get('default_service_type_id') as string || null;

await supabase
  .from('profiles')
  .update({
    name,
    phone,
    default_pickup_location: defaultPickupLocation,
    default_service_type_id: defaultServiceTypeId || null
  })
  .eq('id', clientId);
```

**Step 4: Commit**

```bash
git add src/routes/courier/clients/[id]/edit/+page.svelte src/routes/courier/clients/[id]/edit/+page.server.ts
git commit -m "feat(ui): add default service type to client edit form"
```

---

### Task 20: Add i18n keys for client default type

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

```json
"default_service_type": "Default Service Type",
"default_service_type_desc": "Automatically applied to new services for this client",
```

**Step 2: Add Portuguese keys**

```json
"default_service_type": "Tipo de Serviço Padrão",
"default_service_type_desc": "Aplicado automaticamente a novos serviços deste cliente",
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add client default service type translations"
```

---

## Phase 8: Scheduling UI Adaptation

### Task 21: Create TimePreferencePicker component

**Files:**
- Create: `src/lib/components/TimePreferencePicker.svelte`

This component adapts the scheduling UI for type-based pricing - showing date only by default, with optional time preference expansion.

**Step 1: Write the component**

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { TimeSlot } from '$lib/database.types.js';
	import { Plus, X, Calendar as CalendarIcon, AlertTriangle } from '@lucide/svelte';
	import {
		DateFormatter,
		getLocalTimeZone,
		parseDate,
		today,
		type DateValue
	} from '@internationalized/date';

	interface Props {
		selectedDate: string | null;
		selectedTimeSlot: TimeSlot | null;
		selectedTime: string | null;
		onDateChange: (date: string | null) => void;
		onTimeSlotChange: (slot: TimeSlot | null) => void;
		onTimeChange: (time: string | null) => void;
		disabled?: boolean;
		showPriceWarning?: boolean;
		basePrice?: number;
		timePreferencePrice?: number;
	}

	let {
		selectedDate,
		selectedTimeSlot,
		selectedTime,
		onDateChange,
		onTimeSlotChange,
		onTimeChange,
		disabled = false,
		showPriceWarning = false,
		basePrice = 0,
		timePreferencePrice = 13
	}: Props = $props();

	const getDateFormatter = () =>
		new DateFormatter(getLocale(), { dateStyle: 'long' });

	// svelte-ignore state_referenced_locally
	let calendarValue = $state<DateValue | undefined>(
		selectedDate ? parseDate(selectedDate) : undefined
	);

	$effect(() => {
		calendarValue = selectedDate ? parseDate(selectedDate) : undefined;
	});

	let popoverOpen = $state(false);
	let showTimePreference = $state(!!selectedTimeSlot);

	const timeSlots: { value: TimeSlot; label: () => string }[] = [
		{ value: 'morning', label: () => m.time_slot_morning() },
		{ value: 'afternoon', label: () => m.time_slot_afternoon() },
		{ value: 'evening', label: () => m.time_slot_evening() },
		{ value: 'specific', label: () => m.time_slot_specific() }
	];

	function handleDateSelect(date: DateValue | undefined) {
		calendarValue = date;
		onDateChange(date?.toString() || null);
		popoverOpen = false;
	}

	function handleTimeSlotClick(slot: TimeSlot) {
		if (selectedTimeSlot === slot) {
			onTimeSlotChange(null);
			if (slot === 'specific') onTimeChange(null);
		} else {
			onTimeSlotChange(slot);
			if (slot !== 'specific') onTimeChange(null);
		}
	}

	function removeTimePreference() {
		showTimePreference = false;
		onTimeSlotChange(null);
		onTimeChange(null);
	}

	function addTimePreference() {
		showTimePreference = true;
	}

	const displayDate = $derived(
		calendarValue
			? getDateFormatter().format(calendarValue.toDate(getLocalTimeZone()))
			: m.schedule_select_date()
	);

	const priceDifference = $derived(
		showPriceWarning && selectedTimeSlot ? timePreferencePrice - basePrice : 0
	);
</script>

<div class="space-y-4">
	<!-- Date picker -->
	<div class="space-y-2">
		<Label>{m.schedule_date()}</Label>
		<Popover.Root bind:open={popoverOpen}>
			<Popover.Trigger {disabled}>
				<Button
					variant="outline"
					class="w-full justify-start text-left font-normal {!calendarValue
						? 'text-muted-foreground'
						: ''}"
					{disabled}
				>
					<CalendarIcon class="mr-2 size-4" />
					{displayDate}
				</Button>
			</Popover.Trigger>
			<Popover.Content class="w-auto p-0" align="start">
				<Calendar
					type="single"
					bind:value={calendarValue}
					onValueChange={handleDateSelect}
					minValue={today(getLocalTimeZone())}
					locale={getLocale()}
				/>
			</Popover.Content>
		</Popover.Root>
	</div>

	<!-- Time preference section -->
	{#if !showTimePreference}
		<Button
			type="button"
			variant="ghost"
			class="w-full justify-start text-muted-foreground"
			onclick={addTimePreference}
			{disabled}
		>
			<Plus class="mr-2 size-4" />
			{m.add_time_preference()}
		</Button>
	{:else}
		<div class="space-y-3 rounded-lg border p-4">
			<div class="flex items-center justify-between">
				<Label>{m.schedule_time_slot()}</Label>
				<Button type="button" variant="ghost" size="sm" onclick={removeTimePreference} {disabled}>
					<X class="mr-1 size-4" />
					{m.remove_time_preference()}
				</Button>
			</div>

			<div class="grid grid-cols-2 gap-2">
				{#each timeSlots as slot}
					<Button
						type="button"
						variant={selectedTimeSlot === slot.value ? 'default' : 'outline'}
						size="sm"
						class="w-full"
						onclick={() => handleTimeSlotClick(slot.value)}
						{disabled}
					>
						{slot.label()}
					</Button>
				{/each}
			</div>

			{#if selectedTimeSlot === 'specific'}
				<div class="space-y-2">
					<Label for="specific-time">{m.schedule_time()}</Label>
					<Input
						id="specific-time"
						type="time"
						required
						lang={getLocale()}
						value={selectedTime || ''}
						oninput={(e) => onTimeChange(e.currentTarget.value || null)}
						{disabled}
					/>
				</div>
			{/if}

			<!-- Price warning -->
			{#if showPriceWarning && selectedTimeSlot && priceDifference > 0}
				<div class="flex items-center gap-2 rounded-md bg-amber-50 p-2 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
					<AlertTriangle class="size-4" />
					<span class="text-sm">
						{m.time_preference_surcharge({ amount: `€${priceDifference.toFixed(2)}` })}
					</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
```

**Step 2: Commit**

```bash
git add src/lib/components/TimePreferencePicker.svelte
git commit -m "feat(ui): add TimePreferencePicker component for type-based pricing"
```

---

### Task 22: Add i18n keys for time preference

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

```json
"add_time_preference": "Add time preference",
"remove_time_preference": "Remove",
"time_preference_warning": "Services with time preference have additional cost",
"time_preference_surcharge": "+{amount} for time preference",
```

**Step 2: Add Portuguese keys**

```json
"add_time_preference": "Adicionar preferência de horário",
"remove_time_preference": "Remover",
"time_preference_warning": "Serviços com horário têm custo adicional",
"time_preference_surcharge": "+{amount} pela preferência de horário",
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add time preference translations"
```

---

## Phase 9: Integration (Remaining Tasks)

The remaining tasks follow the same pattern:

### Task 23: Update courier service creation form
- Modify `src/routes/courier/services/new/+page.svelte`
- Add service type selector
- Add zone indicator
- Add tolls input when out-of-zone
- Use TimePreferencePicker when type-based

### Task 24: Update client service creation form
- Modify `src/routes/client/new/+page.svelte`
- Use TimePreferencePicker when type-based
- Show simplified zone indicator
- Hide service type (use client's default)

### Task 25: Update service form server actions
- Modify `src/routes/courier/services/new/+page.server.ts`
- Save service_type_id, has_time_preference, is_out_of_zone, tolls
- Detect municipality from Mapbox response

### Task 26: Integrate type-based pricing into main pricing service
- Modify `src/lib/services/pricing.ts`
- Check pricing_mode
- Call calculateTypedPrice when mode is 'type'

### Task 27: Add tolls i18n keys
```json
"tolls": "Tolls",
"tolls_desc": "Enter exact toll amount for out-of-zone delivery",
"estimated_distance": "Estimated distance",
```

### Task 28: Final testing
- Test pricing mode switch
- Test service types CRUD
- Test distribution zones selection
- Test zone detection
- Test time preference pricing
- Test out-of-zone pricing
- Test client default type

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-5 | Database schema (tables + columns) |
| 2 | 6 | Portugal municipalities data |
| 3 | 7 | Type-based pricing logic |
| 4 | 8-11 | Service types UI |
| 5 | 12-15 | Distribution zones UI |
| 6 | 16-18 | Pricing mode & special pricing |
| 7 | 19-20 | Client default service type |
| 8 | 21-22 | Scheduling UI adaptation |
| 9 | 23-28 | Integration & testing |

**Total: 28 tasks**
