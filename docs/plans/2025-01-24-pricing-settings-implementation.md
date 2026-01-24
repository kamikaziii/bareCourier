# Pricing Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable server-side price calculation at service creation with configurable visibility for courier and client.

**Architecture:** Server actions calculate price using existing TypeScript pricing service. Settings control UI visibility, not calculation. Price is always stored for billing. Urgency dropdown includes virtual "Standard" option mapping to NULL.

**Tech Stack:** SvelteKit form actions, Supabase, TypeScript, shadcn-svelte components

**Design Document:** See `docs/plans/2025-01-24-pricing-settings-design.md` for full context.

---

## Foundation Already Implemented

The following has already been implemented and merged:

- ✅ `calculateServiceDistance()` function in distance.ts
- ✅ `getCourierPricingSettings()` function in pricing.ts (with old field name)
- ✅ Database columns: warehouse_lat, warehouse_lng, auto_calculate_price, default_urgency_fee_id, minimum_charge, round_distance
- ✅ Urgency fee dropdown in client and courier forms
- ✅ Distance breakdown display in forms
- ✅ AddressInput for warehouse address on settings page
- ✅ Basic pricing preferences card on settings page

---

## Task 1: Database Migration - Replace auto_calculate_price

**Files:**
- Apply via Supabase MCP
- Modify: `src/lib/database.types.ts`

**Step 1: Apply migration**

Use `mcp__supabase__apply_migration` with name "pricing_display_settings" and query:

```sql
-- Remove obsolete column
ALTER TABLE profiles DROP COLUMN IF EXISTS auto_calculate_price;

-- Add display visibility settings
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_price_to_courier boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_price_to_client boolean DEFAULT true;

-- Track price overrides
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_override_reason text;

-- Comments
COMMENT ON COLUMN profiles.show_price_to_courier IS 'Whether courier sees price previews in UI';
COMMENT ON COLUMN profiles.show_price_to_client IS 'Whether client sees price previews in UI';
COMMENT ON COLUMN services.price_override_reason IS 'Reason for manual price override';
```

**Step 2: Update database.types.ts - Profile type**

In Row/Insert/Update, remove:
```typescript
auto_calculate_price: boolean | null;
```

Add:
```typescript
show_price_to_courier: boolean | null;
show_price_to_client: boolean | null;
```

**Step 3: Update database.types.ts - Service type**

Add to Row/Insert/Update:
```typescript
price_override_reason: string | null;
```

**Step 4: Update PriceBreakdown type**

Add distance breakdown fields:
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

**Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat: Update types for pricing display settings

- Replace auto_calculate_price with show_price_to_courier/client
- Add price_override_reason to Service type
- Add distance breakdown fields to PriceBreakdown

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update Pricing Service

**Files:**
- Modify: `src/lib/services/pricing.ts`

**Step 1: Update CourierPricingSettings interface**

Replace `autoCalculatePrice` with visibility settings:

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

Change the select and return to use new field names:

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

**Step 3: Add distance breakdown to ServicePricingInput**

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

**Step 4: Update calculateServicePrice to include distance breakdown**

In the breakdown building section, add:

```typescript
const breakdown: PriceBreakdown = {
  base: config.base_fee,
  distance: baseResult.model === 'zone' ? baseResult.price : input.distanceKm * config.per_km_rate,
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

- Replace autoCalculatePrice with showPriceToCourier/Client
- Add distance breakdown to ServicePricingInput
- Include distance breakdown in price calculation result

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update Settings Page

**Files:**
- Modify: `src/routes/courier/settings/+page.svelte`
- Modify: `src/routes/courier/settings/+page.server.ts`

**Step 1: Update state variables in +page.svelte**

Find and replace `autoCalculatePrice` state:

```typescript
// Remove this:
let autoCalculatePrice = $state(data.profile.auto_calculate_price ?? true);

// Add these:
let showPriceToCourier = $state(data.profile.show_price_to_courier ?? true);
let showPriceToClient = $state(data.profile.show_price_to_client ?? true);
```

**Step 2: Update Pricing Preferences card**

Replace the auto-calculate toggle section with two visibility toggles:

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
- Update server action for new fields

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English messages**

Add before the closing brace in `messages/en.json`:

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

**Step 1: Create +page.server.ts**

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

    if (!pickup_location || !delivery_location) {
      return fail(400, { error: 'Pickup and delivery locations are required' });
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

    const { config: pricingConfig } = await getClientPricing(supabase, user.id);

    let calculated_price: number | null = null;
    let price_breakdown: any = null;
    let warning: string | null = null;

    if (!pricingConfig) {
      warning = 'service_created_no_pricing';
    } else if (distance_km !== null) {
      const priceResult = await calculateServicePrice(supabase, {
        clientId: user.id,
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

Add `enhance` import and convert form to use POST:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  // ... other imports
</script>
```

Convert the form element and add hidden fields:

```svelte
<form method="POST" use:enhance class="space-y-4">
  <!-- Existing visible form fields... -->

  <!-- Hidden fields for data -->
  <input type="hidden" name="pickup_location" value={pickupLocation} />
  <input type="hidden" name="delivery_location" value={deliveryLocation} />
  <input type="hidden" name="pickup_lat" value={pickupCoords?.[1] ?? ''} />
  <input type="hidden" name="pickup_lng" value={pickupCoords?.[0] ?? ''} />
  <input type="hidden" name="delivery_lat" value={deliveryCoords?.[1] ?? ''} />
  <input type="hidden" name="delivery_lng" value={deliveryCoords?.[0] ?? ''} />
  <input type="hidden" name="urgency_fee_id" value={selectedUrgencyFeeId ?? ''} />
  <input type="hidden" name="requested_date" value={requestedDate ?? ''} />
  <input type="hidden" name="requested_time_slot" value={requestedTimeSlot ?? ''} />
  <input type="hidden" name="requested_time" value={requestedTime ?? ''} />
  <input type="hidden" name="notes" value={notes} />
</form>
```

**Step 3: Update urgency dropdown with "Standard" option**

```svelte
<select id="urgency" bind:value={selectedUrgencyFeeId} class="...">
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

**Step 4: Commit**

```bash
git add src/routes/client/new/+page.server.ts src/routes/client/new/+page.svelte
git commit -m "feat: Add server-side price calculation for client form

- Create server action with price calculation
- Add 'Standard' urgency option
- Convert to form action with hidden fields

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Courier Form Server Action

**Files:**
- Create: `src/routes/courier/services/+page.server.ts`
- Modify: `src/routes/courier/services/+page.svelte`

**Step 1: Create +page.server.ts**

Similar to client form but for courier (specifies client_id, auto-accepts):

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
      request_status: 'accepted'
    });

    if (insertError) {
      return fail(500, { error: insertError.message });
    }

    return { success: true, warning };
  }
};
```

**Step 2: Update +page.svelte to use form action**

Similar changes as client form.

**Step 3: Commit**

```bash
git add src/routes/courier/services/+page.server.ts src/routes/courier/services/+page.svelte
git commit -m "feat: Add server-side price calculation for courier form

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
  if (!session || !user) return fail(401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'courier') return fail(403);

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

  if (error) return fail(500, { error: error.message });
  return { success: true };
}
```

**Step 2: Add price display and override dialog to +page.svelte**

Add state, dialog UI, and price card.

**Step 3: Commit**

```bash
git add src/routes/courier/services/[id]/+page.svelte src/routes/courier/services/[id]/+page.server.ts
git commit -m "feat: Add price override on service detail page

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Billing Page Enhancements

**Files:**
- Modify: `src/routes/courier/billing/[client_id]/+page.svelte`
- Modify: `src/routes/courier/billing/[client_id]/+page.server.ts`

**Step 1: Add recalculate actions**

**Step 2: Add UI for missing price warning and recalculate buttons**

**Step 3: Highlight rows without price**

**Step 4: Commit**

```bash
git add src/routes/courier/billing/[client_id]/+page.svelte src/routes/courier/billing/[client_id]/+page.server.ts
git commit -m "feat: Add billing page price management

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Testing & Cleanup

**Step 1: Run type check**

```bash
pnpm run check
```

**Step 2: Manual testing checklist**

1. Settings page - verify two visibility toggles work
2. Create service as client - verify price calculated and stored
3. Create service as courier - verify price calculated
4. Test with client without pricing config - verify warning
5. Override price on service detail
6. Billing page recalculate buttons

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: Final cleanup and fixes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Status | Description |
|------|--------|-------------|
| 1 | TODO | Database migration - replace auto_calculate_price |
| 2 | TODO | Update pricing service interfaces |
| 3 | TODO | Update settings page toggles |
| 4 | TODO | Add i18n messages |
| 5 | TODO | Client form server action |
| 6 | TODO | Courier form server action |
| 7 | TODO | Price override UI |
| 8 | TODO | Billing page enhancements |
| 9 | TODO | Testing & cleanup |
