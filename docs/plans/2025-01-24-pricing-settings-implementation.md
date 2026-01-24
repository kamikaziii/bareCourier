# Pricing Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable server-side price calculation at service creation with configurable visibility for courier and client.

**Architecture:** Server actions calculate price using existing TypeScript pricing service. Settings control UI visibility, not calculation. Price is always stored for billing. Urgency dropdown includes virtual "Standard" option mapping to NULL.

**Tech Stack:** SvelteKit form actions, Supabase, TypeScript, shadcn-svelte components

**Design Document:** See `docs/plans/2025-01-24-pricing-settings-design.md` for full context.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/028_pricing_display_settings.sql`
- Modify: `src/lib/database.types.ts`

**Step 1: Create migration file**

```sql
-- Migration: 028_pricing_display_settings
-- Remove obsolete column, add visibility settings

-- Remove obsolete column
ALTER TABLE profiles DROP COLUMN IF EXISTS auto_calculate_price;

-- Add display visibility settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_price_to_courier boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_price_to_client boolean DEFAULT true;

-- Track price overrides
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_override_reason text;

-- Comments for documentation
COMMENT ON COLUMN profiles.show_price_to_courier IS 'Whether courier sees price previews in UI';
COMMENT ON COLUMN profiles.show_price_to_client IS 'Whether client sees price previews in UI';
COMMENT ON COLUMN services.price_override_reason IS 'Reason for manual price override';
```

**Step 2: Apply migration via Supabase MCP**

Run: `mcp__supabase__apply_migration` with name "pricing_display_settings" and the SQL above.

**Step 3: Update database.types.ts - Profile type**

In `src/lib/database.types.ts`, update the Profile Row/Insert/Update types:

Remove:
```typescript
auto_calculate_price: boolean | null;
```

Add:
```typescript
show_price_to_courier: boolean | null;
show_price_to_client: boolean | null;
```

**Step 4: Update database.types.ts - Service type**

Add to Service Row/Insert/Update:
```typescript
price_override_reason: string | null;
```

**Step 5: Update PriceBreakdown type**

Modify the PriceBreakdown type to include distance breakdown:
```typescript
export type PriceBreakdown = {
  base: number;
  distance: number;
  urgency: number;
  total: number;
  model: 'per_km' | 'zone' | 'flat_plus_km';
  distance_km: number;
  error?: string;
  // Distance breakdown (warehouse mode)
  distance_mode?: 'warehouse' | 'zone' | 'fallback';
  warehouse_to_pickup_km?: number;
  pickup_to_delivery_km?: number;
};
```

**Step 6: Commit**

```bash
git add supabase/migrations/028_pricing_display_settings.sql src/lib/database.types.ts
git commit -m "feat: Add pricing display settings migration

- Remove auto_calculate_price column
- Add show_price_to_courier, show_price_to_client
- Add price_override_reason to services
- Update TypeScript types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update Pricing Service

**Files:**
- Modify: `src/lib/services/pricing.ts`

**Step 1: Update CourierPricingSettings interface**

Replace the existing interface:
```typescript
export interface CourierPricingSettings {
  pricingMode: 'warehouse' | 'zone';
  warehouseCoords: [number, number] | null;
  showPriceToCourier: boolean;
  showPriceToClient: boolean;
  defaultUrgencyFeeId: string | null;
  minimumCharge: number;
  roundDistance: boolean;
}
```

**Step 2: Update getCourierPricingSettings function**

```typescript
export async function getCourierPricingSettings(
  supabase: SupabaseClient
): Promise<CourierPricingSettings> {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'pricing_mode, warehouse_lat, warehouse_lng, show_price_to_courier, show_price_to_client, default_urgency_fee_id, minimum_charge, round_distance'
    )
    .eq('role', 'courier')
    .limit(1)
    .single();

  return {
    pricingMode: (profile?.pricing_mode as 'warehouse' | 'zone') || 'zone',
    warehouseCoords:
      profile?.warehouse_lat && profile?.warehouse_lng
        ? [profile.warehouse_lng, profile.warehouse_lat]
        : null,
    showPriceToCourier: profile?.show_price_to_courier ?? true,
    showPriceToClient: profile?.show_price_to_client ?? true,
    defaultUrgencyFeeId: profile?.default_urgency_fee_id || null,
    minimumCharge: profile?.minimum_charge || 0,
    roundDistance: profile?.round_distance ?? false
  };
}
```

**Step 3: Update ServicePricingInput to include distance breakdown**

```typescript
export interface ServicePricingInput {
  clientId: string;
  distanceKm: number | null;
  urgencyFeeId?: string | null;
  minimumCharge?: number;
  // Distance breakdown for storage
  distanceMode?: 'warehouse' | 'zone' | 'fallback';
  warehouseToPickupKm?: number;
  pickupToDeliveryKm?: number;
}
```

**Step 4: Update calculateServicePrice to include distance breakdown in result**

In the breakdown building section, add the distance breakdown fields:
```typescript
const breakdown: PriceBreakdown = {
  base: config.base_fee,
  distance:
    baseResult.model === 'zone' ? baseResult.price : input.distanceKm * config.per_km_rate,
  urgency: urgencyAmount,
  total: priceAfterMinimum,
  model: baseResult.model,
  distance_km: input.distanceKm,
  // Include distance breakdown if provided
  distance_mode: input.distanceMode,
  warehouse_to_pickup_km: input.warehouseToPickupKm,
  pickup_to_delivery_km: input.pickupToDeliveryKm
};
```

**Step 5: Commit**

```bash
git add src/lib/services/pricing.ts
git commit -m "feat: Update pricing service for visibility settings

- Update CourierPricingSettings with show_price_to_* fields
- Include distance breakdown in price calculation
- Remove autoCalculatePrice reference

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update Settings Page

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Update state variables in +page.svelte**

Remove:
```typescript
let autoCalculatePrice = $state(data.profile.auto_calculate_price ?? true);
```

Add:
```typescript
let showPriceToCourier = $state(data.profile.show_price_to_courier ?? true);
let showPriceToClient = $state(data.profile.show_price_to_client ?? true);
```

**Step 2: Update Pricing Preferences card in +page.svelte**

Replace the auto-calculate toggle with two visibility toggles:

```svelte
<!-- Show price to courier -->
<div class="flex items-center justify-between">
  <div class="space-y-0.5">
    <Label>{m.settings_show_price_to_courier()}</Label>
    <p class="text-sm text-muted-foreground">{m.settings_show_price_to_courier_desc()}</p>
  </div>
  <input type="hidden" name="show_price_to_courier" value={showPriceToCourier.toString()} />
  <Switch
    checked={showPriceToCourier}
    onCheckedChange={(checked) => {
      showPriceToCourier = checked;
    }}
  />
</div>

<Separator />

<!-- Show price to client -->
<div class="flex items-center justify-between">
  <div class="space-y-0.5">
    <Label>{m.settings_show_price_to_client()}</Label>
    <p class="text-sm text-muted-foreground">{m.settings_show_price_to_client_desc()}</p>
  </div>
  <input type="hidden" name="show_price_to_client" value={showPriceToClient.toString()} />
  <Switch
    checked={showPriceToClient}
    onCheckedChange={(checked) => {
      showPriceToClient = checked;
    }}
  />
</div>
```

**Step 3: Update updatePricingPreferences action in +page.server.ts**

```typescript
updatePricingPreferences: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const formData = await request.formData();
  const show_price_to_courier = formData.get('show_price_to_courier') === 'true';
  const show_price_to_client = formData.get('show_price_to_client') === 'true';
  const default_urgency_fee_id = (formData.get('default_urgency_fee_id') as string) || null;
  const minimum_charge = parseFloat(formData.get('minimum_charge') as string) || 0;
  const round_distance = formData.get('round_distance') === 'true';

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      show_price_to_courier,
      show_price_to_client,
      default_urgency_fee_id: default_urgency_fee_id || null,
      minimum_charge,
      round_distance
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, message: 'pricing_preferences_updated' };
}
```

**Step 4: Commit**

```bash
git add src/routes/courier/settings/+page.svelte src/routes/courier/settings/+page.server.ts
git commit -m "feat: Replace auto_calculate with visibility toggles

- Add show_price_to_courier toggle
- Add show_price_to_client toggle
- Update server action

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English messages**

Add to `messages/en.json` (before the closing brace):

```json
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
"price_save_override": "Save Override",
"billing_recalculate_missing": "Recalculate missing prices",
"billing_recalculate_all": "Recalculate all",
"billing_missing_price_warning": "Some services have no price calculated",
"service_created_no_pricing": "Service created. No pricing configured for this client."
```

**Step 2: Add Portuguese messages**

Add to `messages/pt-PT.json`:

```json
"price_pending": "Preço pendente",
"price_not_configured": "Configure os preços para este cliente",
"urgency_standard": "Normal (sem taxa extra)",
"settings_show_price_to_courier": "Mostrar preços para mim",
"settings_show_price_to_courier_desc": "Mostrar preços nos formulários e detalhes de serviços",
"settings_show_price_to_client": "Mostrar preços aos clientes",
"settings_show_price_to_client_desc": "Clientes vêem o custo estimado ao criar pedidos",
"price_override": "Alterar preço",
"price_override_reason": "Motivo (opcional)",
"price_calculated": "Calculado",
"price_save_override": "Guardar Alteração",
"billing_recalculate_missing": "Recalcular preços em falta",
"billing_recalculate_all": "Recalcular todos",
"billing_missing_price_warning": "Alguns serviços não têm preço calculado",
"service_created_no_pricing": "Serviço criado. Preços não configurados para este cliente."
```

**Step 3: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat: Add i18n messages for pricing features

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Client Form Server Action

**Files:**
- Create: `src/routes/client/new/+page.server.ts`
- Modify: `src/routes/client/new/+page.svelte`

**Step 1: Create +page.server.ts with form action**

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { calculateServicePrice, getCourierPricingSettings, getClientPricing } from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';
import { localizeHref } from '$lib/paraglide/runtime.js';

export const actions: Actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) {
      return fail(401, { error: 'Not authenticated' });
    }

    const formData = await request.formData();

    // Extract form data
    const pickup_location = formData.get('pickup_location') as string;
    const delivery_location = formData.get('delivery_location') as string;
    const notes = formData.get('notes') as string || null;
    const requested_date = formData.get('requested_date') as string || null;
    const requested_time_slot = formData.get('requested_time_slot') as string || null;
    const requested_time = formData.get('requested_time') as string || null;
    const pickup_lat = formData.get('pickup_lat') ? parseFloat(formData.get('pickup_lat') as string) : null;
    const pickup_lng = formData.get('pickup_lng') ? parseFloat(formData.get('pickup_lng') as string) : null;
    const delivery_lat = formData.get('delivery_lat') ? parseFloat(formData.get('delivery_lat') as string) : null;
    const delivery_lng = formData.get('delivery_lng') ? parseFloat(formData.get('delivery_lng') as string) : null;
    const urgency_fee_id = formData.get('urgency_fee_id') as string || null;

    // Validate required fields
    if (!pickup_location || !delivery_location) {
      return fail(400, { error: 'Pickup and delivery locations are required' });
    }

    // Get courier settings
    const courierSettings = await getCourierPricingSettings(supabase);

    // Calculate distance if coordinates available
    let distance_km: number | null = null;
    let distanceResult: { totalDistanceKm: number; distanceMode: string; warehouseToPickupKm?: number; pickupToDeliveryKm?: number } | null = null;

    if (pickup_lat && pickup_lng && delivery_lat && delivery_lng) {
      distanceResult = await calculateServiceDistance({
        pickupCoords: [pickup_lng, pickup_lat],
        deliveryCoords: [delivery_lng, delivery_lat],
        warehouseCoords: courierSettings.warehouseCoords,
        pricingMode: courierSettings.pricingMode,
        roundDistance: courierSettings.roundDistance
      });
      distance_km = distanceResult.totalDistanceKm;
    }

    // Check if client has pricing config
    const { config: pricingConfig } = await getClientPricing(supabase, user.id);

    let calculated_price: number | null = null;
    let price_breakdown: any = null;
    let warning: string | null = null;

    if (!pricingConfig) {
      // No pricing config - allow creation with warning
      warning = 'service_created_no_pricing';
    } else if (distance_km !== null) {
      // Calculate price
      const priceResult = await calculateServicePrice(supabase, {
        clientId: user.id,
        distanceKm: distance_km,
        urgencyFeeId: urgency_fee_id,
        minimumCharge: courierSettings.minimumCharge,
        distanceMode: distanceResult?.distanceMode as any,
        warehouseToPickupKm: distanceResult?.warehouseToPickupKm,
        pickupToDeliveryKm: distanceResult?.pickupToDeliveryKm
      });

      if (priceResult.success) {
        calculated_price = priceResult.price;
        price_breakdown = priceResult.breakdown;
      }
    }

    // Insert service
    const { error: insertError } = await supabase.from('services').insert({
      client_id: user.id,
      pickup_location,
      delivery_location,
      notes,
      requested_date,
      requested_time_slot,
      requested_time,
      pickup_lat,
      pickup_lng,
      delivery_lat,
      delivery_lng,
      distance_km,
      urgency_fee_id: urgency_fee_id || null,
      calculated_price,
      price_breakdown
    });

    if (insertError) {
      return fail(500, { error: insertError.message });
    }

    redirect(303, localizeHref('/client'));
  }
};
```

**Step 2: Update +page.svelte to use form action**

Convert the client-side submit to a form with hidden fields:

Replace the `handleSubmit` function and form to use `use:enhance`:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  // ... other imports
</script>
```

Update the form to use action and hidden fields for coordinates:

```svelte
<form method="POST" use:enhance class="space-y-4">
  <!-- ... existing visible fields ... -->

  <!-- Hidden fields for coordinates -->
  <input type="hidden" name="pickup_lat" value={pickupCoords?.[1] ?? ''} />
  <input type="hidden" name="pickup_lng" value={pickupCoords?.[0] ?? ''} />
  <input type="hidden" name="delivery_lat" value={deliveryCoords?.[1] ?? ''} />
  <input type="hidden" name="delivery_lng" value={deliveryCoords?.[0] ?? ''} />
  <input type="hidden" name="urgency_fee_id" value={selectedUrgencyFeeId ?? ''} />
  <input type="hidden" name="requested_date" value={requestedDate ?? ''} />
  <input type="hidden" name="requested_time_slot" value={requestedTimeSlot ?? ''} />
  <input type="hidden" name="requested_time" value={requestedTime ?? ''} />

  <!-- Submit button -->
  <Button type="submit" disabled={!pickupLocation || !deliveryLocation}>
    {m.client_create_request()}
  </Button>
</form>
```

**Step 3: Update urgency dropdown with "Standard" option**

```svelte
<select
  id="urgency"
  bind:value={selectedUrgencyFeeId}
  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  <option value="">{m.urgency_standard()}</option>
  {#each urgencyFees as fee (fee.id)}
    <option value={fee.id}>
      {fee.name}
      {#if fee.multiplier > 1 || fee.flat_fee > 0}
        ({fee.multiplier}x{fee.flat_fee > 0 ? ` + €${fee.flat_fee}` : ''})
      {/if}
    </option>
  {/each}
</select>
```

**Step 4: Add conditional price display based on settings**

```svelte
{#if courierSettings?.showPriceToClient && calculated_price !== null}
  <div class="rounded-md bg-muted p-3">
    <div class="flex justify-between">
      <span class="text-muted-foreground">{m.billing_estimated_cost()}</span>
      <span class="font-medium">€{calculated_price.toFixed(2)}</span>
    </div>
  </div>
{/if}
```

**Step 5: Commit**

```bash
git add src/routes/client/new/+page.server.ts src/routes/client/new/+page.svelte
git commit -m "feat: Add server-side price calculation for client form

- Create server action with price calculation
- Add 'Standard' urgency option
- Conditional price display based on settings
- Warning when no pricing config

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Courier Form Server Action

**Files:**
- Create: `src/routes/courier/services/+page.server.ts`
- Modify: `src/routes/courier/services/+page.svelte`

**Step 1: Create +page.server.ts**

Similar to client form but for courier (can specify client_id):

```typescript
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { calculateServicePrice, getCourierPricingSettings, getClientPricing } from '$lib/services/pricing.js';
import { calculateServiceDistance } from '$lib/services/distance.js';

export const actions: Actions = {
  createService: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session || !user) {
      return fail(401, { error: 'Not authenticated' });
    }

    // Verify courier role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'courier') {
      return fail(403, { error: 'Unauthorized' });
    }

    const formData = await request.formData();

    const client_id = formData.get('client_id') as string;
    const pickup_location = formData.get('pickup_location') as string;
    const delivery_location = formData.get('delivery_location') as string;
    const notes = formData.get('notes') as string || null;
    const scheduled_date = formData.get('scheduled_date') as string || null;
    const scheduled_time_slot = formData.get('scheduled_time_slot') as string || null;
    const scheduled_time = formData.get('scheduled_time') as string || null;
    const pickup_lat = formData.get('pickup_lat') ? parseFloat(formData.get('pickup_lat') as string) : null;
    const pickup_lng = formData.get('pickup_lng') ? parseFloat(formData.get('pickup_lng') as string) : null;
    const delivery_lat = formData.get('delivery_lat') ? parseFloat(formData.get('delivery_lat') as string) : null;
    const delivery_lng = formData.get('delivery_lng') ? parseFloat(formData.get('delivery_lng') as string) : null;
    const urgency_fee_id = formData.get('urgency_fee_id') as string || null;

    if (!client_id || !pickup_location || !delivery_location) {
      return fail(400, { error: 'Client, pickup, and delivery are required' });
    }

    const courierSettings = await getCourierPricingSettings(supabase);

    let distance_km: number | null = null;
    let distanceResult: any = null;

    if (pickup_lat && pickup_lng && delivery_lat && delivery_lng) {
      distanceResult = await calculateServiceDistance({
        pickupCoords: [pickup_lng, pickup_lat],
        deliveryCoords: [delivery_lng, delivery_lat],
        warehouseCoords: courierSettings.warehouseCoords,
        pricingMode: courierSettings.pricingMode,
        roundDistance: courierSettings.roundDistance
      });
      distance_km = distanceResult.totalDistanceKm;
    }

    const { config: pricingConfig } = await getClientPricing(supabase, client_id);

    let calculated_price: number | null = null;
    let price_breakdown: any = null;
    let warning: string | null = null;

    if (!pricingConfig) {
      warning = 'service_created_no_pricing';
    } else if (distance_km !== null) {
      const priceResult = await calculateServicePrice(supabase, {
        clientId: client_id,
        distanceKm: distance_km,
        urgencyFeeId: urgency_fee_id,
        minimumCharge: courierSettings.minimumCharge,
        distanceMode: distanceResult?.distanceMode,
        warehouseToPickupKm: distanceResult?.warehouseToPickupKm,
        pickupToDeliveryKm: distanceResult?.pickupToDeliveryKm
      });

      if (priceResult.success) {
        calculated_price = priceResult.price;
        price_breakdown = priceResult.breakdown;
      }
    }

    const { error: insertError } = await supabase.from('services').insert({
      client_id,
      pickup_location,
      delivery_location,
      notes,
      scheduled_date,
      scheduled_time_slot,
      scheduled_time: scheduled_time_slot === 'specific' ? scheduled_time : null,
      pickup_lat,
      pickup_lng,
      delivery_lat,
      delivery_lng,
      distance_km,
      urgency_fee_id: urgency_fee_id || null,
      calculated_price,
      price_breakdown,
      request_status: 'accepted' // Courier-created services are auto-accepted
    });

    if (insertError) {
      return fail(500, { error: insertError.message });
    }

    return { success: true, warning };
  }
};
```

**Step 2: Update +page.svelte form**

Convert to use form action with `use:enhance`, similar to client form.

**Step 3: Update urgency dropdown with "Standard" option**

Same pattern as client form.

**Step 4: Add conditional price display**

Check `courierSettings.showPriceToCourier` before displaying price.

**Step 5: Commit**

```bash
git add src/routes/courier/services/+page.server.ts src/routes/courier/services/+page.svelte
git commit -m "feat: Add server-side price calculation for courier form

- Create server action with price calculation
- Add 'Standard' urgency option
- Conditional price display based on settings

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Price Override to Service Detail

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte`
- Modify: `src/routes/courier/services/[id]/+page.server.ts`

**Step 1: Add overridePrice action to +page.server.ts**

```typescript
overridePrice: async ({ request, params, locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();
  if (!session || !user) {
    return fail(401, { error: 'Not authenticated' });
  }

  // Verify courier role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'courier') {
    return fail(403, { error: 'Unauthorized' });
  }

  const formData = await request.formData();
  const override_price = parseFloat(formData.get('override_price') as string);
  const override_reason = formData.get('override_reason') as string || null;

  if (isNaN(override_price) || override_price < 0) {
    return fail(400, { error: 'Invalid price' });
  }

  const { error } = await supabase
    .from('services')
    .update({
      calculated_price: override_price,
      price_override_reason: override_reason
    })
    .eq('id', params.id);

  if (error) {
    return fail(500, { error: error.message });
  }

  return { success: true, message: 'price_updated' };
}
```

**Step 2: Add price override UI to +page.svelte**

Add a section showing current price and override form:

```svelte
{#if courierSettings?.showPriceToCourier}
  <Card.Root>
    <Card.Header>
      <Card.Title>{m.billing_price()}</Card.Title>
    </Card.Header>
    <Card.Content>
      {#if service.calculated_price !== null}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">€{service.calculated_price.toFixed(2)}</p>
            {#if service.price_override_reason}
              <p class="text-sm text-muted-foreground">{service.price_override_reason}</p>
            {/if}
          </div>
          <Button variant="outline" onclick={() => showPriceOverride = true}>
            {m.price_override()}
          </Button>
        </div>
      {:else}
        <p class="text-muted-foreground">{m.price_pending()}</p>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}

<!-- Price Override Dialog -->
<AlertDialog.Root bind:open={showPriceOverride}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m.price_override()}</AlertDialog.Title>
    </AlertDialog.Header>
    <form method="POST" action="?/overridePrice" use:enhance>
      <div class="space-y-4 py-4">
        {#if service.calculated_price !== null}
          <p class="text-sm text-muted-foreground">
            {m.price_calculated()}: €{service.calculated_price.toFixed(2)}
          </p>
        {/if}
        <div class="space-y-2">
          <Label for="override_price">{m.price_override()}</Label>
          <Input
            id="override_price"
            name="override_price"
            type="number"
            step="0.01"
            min="0"
            value={service.calculated_price ?? ''}
            required
          />
        </div>
        <div class="space-y-2">
          <Label for="override_reason">{m.price_override_reason()}</Label>
          <Input
            id="override_reason"
            name="override_reason"
            value={service.price_override_reason ?? ''}
          />
        </div>
      </div>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>{m.action_cancel()}</AlertDialog.Cancel>
        <Button type="submit">{m.price_save_override()}</Button>
      </AlertDialog.Footer>
    </form>
  </AlertDialog.Content>
</AlertDialog.Root>
```

**Step 3: Commit**

```bash
git add src/routes/courier/services/[id]/+page.svelte src/routes/courier/services/[id]/+page.server.ts
git commit -m "feat: Add price override on service detail page

- Add overridePrice server action
- Add override dialog UI
- Show override reason if set

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Billing Page Enhancements

**Files:**
- Modify: `src/routes/courier/billing/[client_id]/+page.svelte`
- Modify: `src/routes/courier/billing/[client_id]/+page.server.ts`

**Step 1: Add recalculate actions to +page.server.ts**

```typescript
recalculateMissing: async ({ params, locals: { supabase, safeGetSession } }) => {
  // Recalculate prices for services where calculated_price IS NULL
  const { session, user } = await safeGetSession();
  if (!session || !user) return fail(401);

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('client_id', params.client_id)
    .is('calculated_price', null)
    .is('deleted_at', null);

  if (!services || services.length === 0) {
    return { success: true, count: 0 };
  }

  const courierSettings = await getCourierPricingSettings(supabase);
  let updated = 0;

  for (const service of services) {
    if (service.distance_km) {
      const priceResult = await calculateServicePrice(supabase, {
        clientId: service.client_id,
        distanceKm: service.distance_km,
        urgencyFeeId: service.urgency_fee_id,
        minimumCharge: courierSettings.minimumCharge
      });

      if (priceResult.success) {
        await supabase
          .from('services')
          .update({
            calculated_price: priceResult.price,
            price_breakdown: priceResult.breakdown
          })
          .eq('id', service.id);
        updated++;
      }
    }
  }

  return { success: true, count: updated };
},

recalculateAll: async ({ params, locals: { supabase, safeGetSession } }) => {
  // Similar but for all services in the period
  // ... implementation similar to above but without the IS NULL filter
}
```

**Step 2: Add UI for missing price warning and recalculate buttons**

```svelte
{#if servicesWithoutPrice > 0}
  <div class="rounded-md bg-orange-100 p-3 text-orange-800 flex items-center justify-between">
    <span>{m.billing_missing_price_warning()} ({servicesWithoutPrice})</span>
    <form method="POST" action="?/recalculateMissing" use:enhance>
      <Button type="submit" variant="outline" size="sm">
        {m.billing_recalculate_missing()}
      </Button>
    </form>
  </div>
{/if}
```

**Step 3: Highlight rows without price**

```svelte
<tr class="{service.calculated_price === null ? 'bg-orange-50' : ''}">
  <!-- ... -->
  <td>
    {#if service.calculated_price !== null}
      €{service.calculated_price.toFixed(2)}
    {:else}
      <span class="text-orange-600">{m.price_pending()}</span>
    {/if}
  </td>
</tr>
```

**Step 4: Commit**

```bash
git add src/routes/courier/billing/[client_id]/+page.svelte src/routes/courier/billing/[client_id]/+page.server.ts
git commit -m "feat: Add billing page price management

- Highlight services without prices
- Add recalculate missing prices button
- Add recalculate all button

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Testing & Cleanup

**Step 1: Run type check**

```bash
pnpm run check
```

Fix any type errors introduced.

**Step 2: Test manually**

1. Set pricing visibility settings (courier settings page)
2. Create service as client - verify price calculated
3. Create service as courier - verify price calculated
4. Test with client that has no pricing config - verify warning
5. Override price on service detail
6. Test billing page recalculate buttons

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: Final cleanup and fixes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | migration, types |
| 2 | Update pricing service | pricing.ts |
| 3 | Update settings page | settings page + server |
| 4 | Add i18n messages | en.json, pt-PT.json |
| 5 | Client form server action | client/new |
| 6 | Courier form server action | courier/services |
| 7 | Price override UI | courier/services/[id] |
| 8 | Billing page enhancements | courier/billing |
| 9 | Testing & cleanup | all |
