# Type-Based Pricing Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all gaps identified in the PR #7 type-based pricing audit to complete the feature as designed.

**Architecture:** This is a fix/completion pass, not new architecture. We'll update existing components to add missing functionality: price breakdowns in service details, manual zone override, live price previews, and new client creation form with service type.

**Tech Stack:** SvelteKit 2.50+ | Svelte 5 (runes) | TypeScript | Tailwind CSS v4 | shadcn-svelte | Supabase

---

## Finding Summary

| ID | Severity | Description |
|----|----------|-------------|
| H1 | HIGH | Client new form missing (only edit has service type) |
| H2 | HIGH | TimePreferencePicker warning not shown on expansion |
| H3 | HIGH | Service details missing price breakdown |
| H4 | HIGH | Zone detection missing manual override fallback |
| M1 | MEDIUM | Distribution zones search filter (already implemented - verified) |
| M2 | MEDIUM | Client form missing zone indicator badge |
| M3 | MEDIUM | Service types active/inactive toggle (already implemented - verified) |
| M4 | MEDIUM | Price display missing visibility setting respect |
| M5 | MEDIUM | Courier service form missing live price preview |
| M6 | MEDIUM | Client form missing estimated price display |
| L1 | LOW | Missing i18n keys |
| L2 | LOW | Distribution zones missing selected summary (already has badge) |
| L3 | LOW | Service edit form not updated for type-based pricing |

**Note:** M1, M3, L2 were verified as already implemented during audit - removed from plan.

---

## Task 1: Add Missing i18n Keys (L1)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add i18n keys to English messages**

Add after line 721 (before the closing `}`):

```json
	"price_estimate": "Estimated price",
	"price_final_note": "Final price confirmed by courier",
	"zone_override_title": "Zone Override",
	"zone_detection_failed": "Could not determine municipality",
	"zone_manual_select": "Select manually",
	"mark_in_zone": "Mark as in-zone",
	"mark_out_of_zone": "Mark as out-of-zone",
	"price_breakdown": "Price Breakdown",
	"base_price": "Base price",
	"distance_charge": "Distance charge",
	"total_price": "Total",
	"time_preference_surcharge": "+€{amount} for time preference"
```

**Step 2: Add i18n keys to Portuguese messages**

Add after line 721 (before the closing `}`):

```json
	"price_estimate": "Preço estimado",
	"price_final_note": "Preço final confirmado pelo estafeta",
	"zone_override_title": "Substituição de Zona",
	"zone_detection_failed": "Não foi possível determinar o concelho",
	"zone_manual_select": "Selecionar manualmente",
	"mark_in_zone": "Marcar como dentro da zona",
	"mark_out_of_zone": "Marcar como fora da zona",
	"price_breakdown": "Discriminação do Preço",
	"base_price": "Preço base",
	"distance_charge": "Custo de distância",
	"total_price": "Total",
	"time_preference_surcharge": "+€{amount} pela preferência de horário"
```

**Step 3: Run paraglide to regenerate types**

Run: `pnpm run check`
Expected: TypeScript check passes, new message functions available

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "$(cat <<'EOF'
feat(i18n): add missing type-based pricing translations

Adds keys for:
- Price estimates and breakdowns
- Zone override manual selection
- Time preference surcharge display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update Service Details Price Breakdown (H3)

**Files:**
- Modify: `src/routes/courier/services/[id]/+page.svelte:349-416`

**Step 1: Update the Price card to show detailed breakdown**

Replace the Price card content section (around lines 349-416) with enhanced breakdown display:

```svelte
<!-- Price -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Euro class="size-5" />
			{m.billing_price()}
		</Card.Title>
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
				<Button variant="outline" onclick={() => (showPriceOverride = true)}>
					{m.price_override()}
				</Button>
			</div>
		{:else}
			<div class="flex items-center justify-between">
				<p class="text-muted-foreground">{m.price_pending()}</p>
				<Button variant="outline" onclick={() => (showPriceOverride = true)}>
					{m.price_override()}
				</Button>
			</div>
		{/if}

		<!-- Type-based pricing detailed breakdown -->
		{#if service.price_breakdown?.model === 'type'}
			<Separator class="my-4" />
			<div class="space-y-2 text-sm">
				<p class="font-medium text-muted-foreground">{m.price_breakdown()}</p>

				{#if service.service_types?.name}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.service_type()}</span>
						<span class="font-medium">{service.service_types.name}</span>
					</div>
				{/if}

				{#if service.price_breakdown.reason === 'out_of_zone'}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.base_price()} ({m.out_of_zone()})</span>
						<span>€{service.price_breakdown.base.toFixed(2)}</span>
					</div>
					{#if service.price_breakdown.distance > 0}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.distance_charge()} ({service.distance_km?.toFixed(1)} km)</span>
							<span>€{service.price_breakdown.distance.toFixed(2)}</span>
						</div>
					{/if}
					{#if service.price_breakdown.tolls > 0}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.tolls()}</span>
							<span>€{service.price_breakdown.tolls.toFixed(2)}</span>
						</div>
					{/if}
				{:else if service.price_breakdown.reason === 'time_preference'}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.time_preference_label()}</span>
						<span>€{service.price_breakdown.base.toFixed(2)}</span>
					</div>
				{:else}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.base_price()}</span>
						<span>€{service.price_breakdown.base.toFixed(2)}</span>
					</div>
				{/if}

				<Separator />
				<div class="flex justify-between font-medium">
					<span>{m.total_price()}</span>
					<span>€{service.price_breakdown.total.toFixed(2)}</span>
				</div>
			</div>
		{:else if service.service_type_id || service.is_out_of_zone !== null || service.tolls}
			<!-- Fallback: Simple display for services without full breakdown -->
			<Separator class="my-4" />
			<div class="space-y-2 text-sm">
				{#if service.service_types?.name}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.service_type()}</span>
						<span class="font-medium">{service.service_types.name}</span>
					</div>
				{/if}
				{#if service.is_out_of_zone !== null}
					<div class="flex items-center justify-between">
						<span class="text-muted-foreground">{m.zone_status()}</span>
						{#if !service.is_out_of_zone}
							<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
								{m.in_zone()}
							</Badge>
						{:else}
							<Badge variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
								{m.out_of_zone()}
							</Badge>
						{/if}
					</div>
				{/if}
				{#if service.has_time_preference}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.time_preference_label()}</span>
						<span>{m.yes()}</span>
					</div>
				{/if}
				{#if service.tolls && service.tolls > 0}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.tolls_label()}</span>
						<span>€{Number(service.tolls).toFixed(2)}</span>
					</div>
				{/if}
				{#if service.distance_km && service.is_out_of_zone}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.distance_label()}</span>
						<span>{service.distance_km.toFixed(1)} km</span>
					</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
```

**Step 2: Run type check**

Run: `pnpm run check`
Expected: PASS - no type errors

**Step 3: Manual test**

1. Create a type-based service with out-of-zone pricing
2. Navigate to service details
3. Verify the price breakdown shows base, distance, tolls, total

**Step 4: Commit**

```bash
git add src/routes/courier/services/\[id\]/+page.svelte
git commit -m "$(cat <<'EOF'
feat(service-details): add detailed price breakdown for type-based pricing

Shows itemized breakdown: base price, distance charge, tolls, total
Displays differently for out-of-zone vs time-preference vs normal pricing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Manual Zone Override (H4) - COMPLETED

**Status:** COMPLETED (commit 4b5cb2f)

**Files Changed:**
- Created: `src/lib/components/ZoneOverrideToggle.svelte`
- Modified: `src/routes/client/new/+page.svelte`
- Modified: `src/routes/courier/services/new/+page.svelte`

**Implementation Summary:**
- Created ZoneOverrideToggle component with 4 states:
  1. Loading spinner while checking zone
  2. Detection failed warning with manual override buttons
  3. In-zone badge (green)
  4. Out-of-zone badge (amber with detected municipality)
- Replaced inline zone indicator in courier form
- Replaced out-of-zone warning in client form with the new component
- Both forms now support manual zone selection when auto-detection fails

**Original Plan (for reference):**

~~**Step 1: Create ZoneOverrideToggle component**~~

Create: `src/lib/components/ZoneOverrideToggle.svelte`

```svelte
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, MapPin, CheckCircle } from '@lucide/svelte';

	interface Props {
		isOutOfZone: boolean | null;
		detectedMunicipality: string | null;
		checkingZone: boolean;
		onOverride: (outOfZone: boolean) => void;
		disabled?: boolean;
	}

	let {
		isOutOfZone,
		detectedMunicipality,
		checkingZone,
		onOverride,
		disabled = false
	}: Props = $props();

	let showManualOverride = $state(false);
</script>

{#if checkingZone}
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<div class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		<span>Checking zone...</span>
	</div>
{:else if isOutOfZone === null && !detectedMunicipality}
	<!-- Detection failed - show manual override -->
	<div class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
		<div class="flex items-start gap-2">
			<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<div class="flex-1 space-y-2">
				<p class="text-sm text-amber-800 dark:text-amber-200">
					{m.zone_detection_failed()}
				</p>
				{#if !showManualOverride}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (showManualOverride = true)}
						{disabled}
					>
						{m.zone_manual_select()}
					</Button>
				{:else}
					<div class="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-950/50"
							onclick={() => onOverride(false)}
							{disabled}
						>
							<CheckCircle class="mr-1 size-3 text-green-600" />
							{m.mark_in_zone()}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/50"
							onclick={() => onOverride(true)}
							{disabled}
						>
							<MapPin class="mr-1 size-3 text-amber-600" />
							{m.mark_out_of_zone()}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{:else if isOutOfZone === true}
	<div class="flex items-center gap-2">
		<Badge variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
			<MapPin class="mr-1 size-3" />
			{m.out_of_zone()}
		</Badge>
		{#if detectedMunicipality}
			<span class="text-xs text-muted-foreground">({detectedMunicipality})</span>
		{/if}
	</div>
{:else if isOutOfZone === false}
	<div class="flex items-center gap-2">
		<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
			<CheckCircle class="mr-1 size-3" />
			{m.in_zone()}
		</Badge>
		{#if detectedMunicipality}
			<span class="text-xs text-muted-foreground">({detectedMunicipality})</span>
		{/if}
	</div>
{/if}
```

**Step 2: Update client new page to use ZoneOverrideToggle**

In `src/routes/client/new/+page.svelte`, add import and replace the out-of-zone warning:

Add import:
```svelte
import ZoneOverrideToggle from '$lib/components/ZoneOverrideToggle.svelte';
```

Replace the out-of-zone warning block (lines ~268-273) with:
```svelte
<!-- Zone indicator with manual override -->
{#if isTypePricingMode && deliveryLocation}
	<ZoneOverrideToggle
		{isOutOfZone}
		{detectedMunicipality}
		{checkingZone}
		onOverride={(outOfZone) => (isOutOfZone = outOfZone)}
		disabled={loading}
	/>
{/if}
```

**Step 3: Update courier new page similarly**

In `src/routes/courier/services/new/+page.svelte`, add the same zone indicator after the delivery address input.

**Step 4: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/components/ZoneOverrideToggle.svelte \
        src/routes/client/new/+page.svelte \
        src/routes/courier/services/new/+page.svelte
git commit -m "$(cat <<'EOF'
feat(zone-detection): add manual override when auto-detection fails

Creates ZoneOverrideToggle component that:
- Shows zone status badge when detected
- Prompts for manual selection when detection fails
- Allows marking as in-zone or out-of-zone

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update TimePreferencePicker Warning (H2)

**Files:**
- Modify: `src/lib/components/TimePreferencePicker.svelte`

**Step 1: Show warning text immediately on expansion**

Update the expanded section (around line 217) to show a subtle info text before slot selection:

Find the expanded section starting with `{:else}` around line 215 and add info text after the label:

```svelte
{:else}
	<!-- Expanded: show time slot selection -->
	<div class="space-y-3 rounded-md border p-3">
		<div class="flex items-center justify-between">
			<Label>{m.schedule_time_slot()}</Label>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-6 px-2 text-muted-foreground"
				onclick={collapseTimePreference}
				{disabled}
			>
				<!-- ... close icon ... -->
			</Button>
		</div>

		<!-- Info text shown immediately on expansion -->
		{#if showPriceWarning && timePreferencePrice > 0}
			<p class="text-xs text-muted-foreground">
				{m.time_preference_surcharge({ amount: timePreferencePrice.toFixed(2) })}
			</p>
		{/if}

		<div class="grid grid-cols-2 gap-2">
			<!-- ... time slot buttons ... -->
		</div>
		<!-- ... rest of component ... -->
	</div>
{/if}
```

**Step 2: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/components/TimePreferencePicker.svelte
git commit -m "$(cat <<'EOF'
fix(TimePreferencePicker): show price warning on expansion

Shows surcharge info immediately when section expands,
not just after selecting a time slot.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Zone Badge to Client Form (M2)

**Files:**
- Modify: `src/routes/client/new/+page.svelte`

This was partially done in Task 3 with ZoneOverrideToggle. Now ensure the badge displays in the same location as courier form.

**Step 1: Verify ZoneOverrideToggle is placed after delivery address**

The ZoneOverrideToggle should be right after the delivery location input, showing the zone badge. If not already there, move it:

```svelte
<div class="space-y-2">
	<Label for="delivery">{m.form_delivery_location()}</Label>
	{#if hasMapbox}
		<AddressInput
			id="delivery"
			bind:value={deliveryLocation}
			onSelect={handleDeliverySelect}
			placeholder={m.form_delivery_placeholder()}
			disabled={loading}
		/>
	{:else}
		<Input ... />
	{/if}

	<!-- Zone indicator placed directly under delivery input -->
	{#if isTypePricingMode && deliveryLocation}
		<ZoneOverrideToggle
			{isOutOfZone}
			{detectedMunicipality}
			{checkingZone}
			onOverride={(outOfZone) => (isOutOfZone = outOfZone)}
			disabled={loading}
		/>
	{/if}
</div>
```

**Step 2: Commit if changes were made**

```bash
git add src/routes/client/new/+page.svelte
git commit -m "$(cat <<'EOF'
fix(client-form): ensure zone indicator is positioned correctly

Places zone badge directly under delivery address field

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Price Estimate to Client Form (M6)

**Files:**
- Modify: `src/routes/client/new/+page.svelte`
- Modify: `src/routes/client/new/+page.ts`

**Step 1: Update load function to pass show_price_to_client setting**

In `src/routes/client/new/+page.ts` (or create if it doesn't exist), add:

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	// Get courier's pricing visibility setting
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('show_price_to_client')
		.eq('role', 'courier')
		.limit(1)
		.single();

	return {
		showPriceToClient: courierProfile?.show_price_to_client ?? true
	};
};
```

**Step 2: Add price estimate section to client form**

Add after the hidden fields section, before the buttons:

```svelte
<!-- Price Estimate (only if show_price_to_client is true) -->
{#if isTypePricingMode && data.showPriceToClient && data.typePricingSettings}
	<Separator />
	<div class="rounded-md bg-muted/50 p-4 space-y-2">
		<p class="text-sm font-medium">{m.price_estimate()}</p>

		{#if isOutOfZone === true}
			<p class="text-lg font-bold text-amber-600">
				€{data.typePricingSettings.outOfZoneBase.toFixed(2)} + {m.distance_charge()}
			</p>
			<p class="text-xs text-muted-foreground">{m.out_of_zone_client_warning()}</p>
		{:else if hasTimePreference}
			<p class="text-lg font-bold">
				€{data.typePricingSettings.timeSpecificPrice.toFixed(2)}
			</p>
		{:else}
			<p class="text-lg font-bold">
				{m.price_final_note()}
			</p>
		{/if}
	</div>
{/if}
```

**Step 3: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/routes/client/new/+page.svelte src/routes/client/new/+page.ts
git commit -m "$(cat <<'EOF'
feat(client-form): add price estimate section

Shows estimated price based on zone and time preference
Respects show_price_to_client setting

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Live Price Preview to Courier Form (M5)

**Files:**
- Modify: `src/routes/courier/services/new/+page.svelte`
- Create: `src/lib/components/TypePricePreview.svelte`

**Step 1: Create TypePricePreview component**

Create: `src/lib/components/TypePricePreview.svelte`

```svelte
<script lang="ts">
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { TypePricingSettings } from '$lib/services/type-pricing.js';
	import type { ServiceType } from '$lib/database.types.js';

	interface Props {
		settings: TypePricingSettings | null;
		serviceType: ServiceType | null;
		isOutOfZone: boolean | null;
		hasTimePreference: boolean;
		distanceKm: number | null;
		tolls: number | null;
	}

	let {
		settings,
		serviceType,
		isOutOfZone,
		hasTimePreference,
		distanceKm,
		tolls
	}: Props = $props();

	// Calculate preview price
	const preview = $derived.by(() => {
		if (!settings || !serviceType) return null;

		// Out-of-zone takes priority
		if (isOutOfZone) {
			const base = settings.outOfZoneBase;
			const distance = (distanceKm ?? 0) * settings.outOfZonePerKm;
			const tollCost = tolls ?? 0;
			return {
				reason: 'out_of_zone' as const,
				base,
				distance,
				tolls: tollCost,
				total: base + distance + tollCost
			};
		}

		// Time preference
		if (hasTimePreference && settings.timeSpecificPrice > 0) {
			return {
				reason: 'time_preference' as const,
				base: settings.timeSpecificPrice,
				distance: 0,
				tolls: 0,
				total: settings.timeSpecificPrice
			};
		}

		// Normal service type price
		return {
			reason: 'service_type' as const,
			base: serviceType.price,
			distance: 0,
			tolls: 0,
			total: serviceType.price
		};
	});
</script>

{#if preview}
	<div class="rounded-md border bg-muted/30 p-4 space-y-2">
		<p class="text-sm font-medium text-muted-foreground">{m.price_breakdown()}</p>

		{#if preview.reason === 'out_of_zone'}
			<div class="space-y-1 text-sm">
				<div class="flex justify-between">
					<span class="text-muted-foreground">{m.base_price()} ({m.out_of_zone()})</span>
					<span>€{preview.base.toFixed(2)}</span>
				</div>
				{#if preview.distance > 0}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.distance_charge()} ({distanceKm?.toFixed(1)} km)</span>
						<span>€{preview.distance.toFixed(2)}</span>
					</div>
				{/if}
				{#if preview.tolls > 0}
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.tolls()}</span>
						<span>€{preview.tolls.toFixed(2)}</span>
					</div>
				{/if}
			</div>
		{:else if preview.reason === 'time_preference'}
			<div class="flex justify-between text-sm">
				<span class="text-muted-foreground">{m.time_preference_label()}</span>
				<span>€{preview.base.toFixed(2)}</span>
			</div>
		{:else}
			<div class="flex justify-between text-sm">
				<span class="text-muted-foreground">{serviceType?.name}</span>
				<span>€{preview.base.toFixed(2)}</span>
			</div>
		{/if}

		<Separator />
		<div class="flex justify-between font-medium">
			<span>{m.total_price()}</span>
			<span class="text-lg">€{preview.total.toFixed(2)}</span>
		</div>
	</div>
{/if}
```

**Step 2: Add TypePricePreview to courier service form**

In `src/routes/courier/services/new/+page.svelte`, add import:

```svelte
import TypePricePreview from '$lib/components/TypePricePreview.svelte';
```

Add after the time preference section (before the hidden fields):

```svelte
<!-- Live Price Preview (type-based pricing only) -->
{#if isTypePricingMode && selectedServiceType}
	<Separator />
	<TypePricePreview
		settings={typePricingSettings}
		serviceType={selectedServiceType}
		{isOutOfZone}
		{hasTimePreference}
		{distanceKm}
		{tolls}
	/>
{/if}
```

**Note:** This requires the courier form to have service type selection and tolls input, which should be verified/added.

**Step 3: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/components/TypePricePreview.svelte \
        src/routes/courier/services/new/+page.svelte
git commit -m "$(cat <<'EOF'
feat(courier-form): add live price preview for type-based pricing

Creates TypePricePreview component that calculates and displays:
- Out-of-zone: base + distance + tolls
- Time preference: fixed price
- Normal: service type price

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Service Edit Form for Type-Based Pricing (L3)

**Files:**
- Modify: `src/routes/courier/services/[id]/edit/+page.svelte`
- Modify: `src/routes/courier/services/[id]/edit/+page.server.ts`

**Step 1: Add type-based pricing state to edit form**

In `src/routes/courier/services/[id]/edit/+page.svelte`, add imports:

```svelte
import TimePreferencePicker from '$lib/components/TimePreferencePicker.svelte';
import ZoneOverrideToggle from '$lib/components/ZoneOverrideToggle.svelte';
import TypePricePreview from '$lib/components/TypePricePreview.svelte';
```

Add state variables:

```svelte
// Type-based pricing state (after existing state declarations)
// svelte-ignore state_referenced_locally
let serviceTypeId = $state<string>(data.service.service_type_id || '');
// svelte-ignore state_referenced_locally
let hasTimePreference = $state(data.service.has_time_preference ?? false);
// svelte-ignore state_referenced_locally
let isOutOfZone = $state<boolean | null>(data.service.is_out_of_zone);
// svelte-ignore state_referenced_locally
let tolls = $state<string>(data.service.tolls?.toString() || '');
// svelte-ignore state_referenced_locally
let detectedMunicipality = $state<string | null>(data.service.detected_municipality);

const isTypePricingMode = $derived(data.pricingMode === 'type');
```

**Step 2: Add type-based fields to form UI**

Add conditional sections based on pricing mode:

```svelte
{#if isTypePricingMode}
	<Separator />

	<!-- Service Type Selection -->
	<div class="space-y-2">
		<Label for="service_type">{m.service_type()}</Label>
		<select
			id="service_type"
			name="service_type_id"
			bind:value={serviceTypeId}
			disabled={loading}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="">{m.form_select_client()}</option>
			{#each data.serviceTypes as type (type.id)}
				<option value={type.id}>{type.name} - €{type.price.toFixed(2)}</option>
			{/each}
		</select>
	</div>

	<!-- Zone indicator -->
	<ZoneOverrideToggle
		{isOutOfZone}
		{detectedMunicipality}
		checkingZone={false}
		onOverride={(outOfZone) => (isOutOfZone = outOfZone)}
		disabled={loading}
	/>

	<!-- Tolls (only if out of zone) -->
	{#if isOutOfZone}
		<div class="space-y-2">
			<Label for="tolls">{m.tolls_label()}</Label>
			<Input
				id="tolls"
				name="tolls"
				type="number"
				step="0.01"
				min="0"
				bind:value={tolls}
				placeholder={m.tolls_placeholder()}
				disabled={loading}
			/>
		</div>
	{/if}
{:else}
	<!-- Existing urgency fee selection -->
	<Separator />
	<div class="space-y-2">
		<Label for="urgency">{m.form_urgency()}</Label>
		<UrgencyFeeSelect fees={urgencyFees} bind:value={selectedUrgencyFeeId} disabled={loading} />
	</div>
{/if}
```

**Step 3: Add hidden fields for submission**

```svelte
<!-- Type-based pricing hidden fields -->
{#if isTypePricingMode}
	<input type="hidden" name="service_type_id" value={serviceTypeId} />
	<input type="hidden" name="has_time_preference" value={hasTimePreference} />
	<input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? ''} />
	<input type="hidden" name="tolls" value={tolls} />
	<input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
{:else}
	<input type="hidden" name="urgency_fee_id" value={selectedUrgencyFeeId} />
{/if}
```

**Step 4: Update server action to handle type-based fields**

In `+page.server.ts`, update the default action to read and save type-based fields.

**Step 5: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/courier/services/\[id\]/edit/+page.svelte \
        src/routes/courier/services/\[id\]/edit/+page.server.ts
git commit -m "$(cat <<'EOF'
feat(service-edit): support type-based pricing fields

Adds to edit form:
- Service type selector
- Zone indicator with override
- Tolls input for out-of-zone
- Hidden fields for submission

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Price Visibility Setting Checks (M4)

**Files:**
- Modify: `src/routes/courier/services/new/+page.svelte`
- Modify: `src/routes/client/new/+page.svelte`

**Step 1: Update courier form to respect show_price_to_courier**

Wrap price preview in conditional:

```svelte
{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
	<TypePricePreview ... />
{/if}
```

**Step 2: Ensure client form respects show_price_to_client**

Already done in Task 6 - verify it's working:

```svelte
{#if isTypePricingMode && data.showPriceToClient && data.typePricingSettings}
	<!-- Price estimate section -->
{/if}
```

**Step 3: Commit**

```bash
git add src/routes/courier/services/new/+page.svelte \
        src/routes/client/new/+page.svelte
git commit -m "$(cat <<'EOF'
fix(pricing): respect price visibility settings

Price previews only shown when:
- show_price_to_courier is true (courier form)
- show_price_to_client is true (client form)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Create New Client Form with Service Type (H1)

**Files:**
- Create: `src/routes/courier/clients/new/+page.svelte`
- Create: `src/routes/courier/clients/new/+page.server.ts`

**Step 1: Create the page server file**

Create: `src/routes/courier/clients/new/+page.server.ts`

```typescript
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import { getServiceTypes } from '$lib/services/type-pricing.js';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Get courier's pricing mode and service types
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('pricing_mode')
		.eq('id', user.id)
		.single();

	const pricingMode = (courierProfile?.pricing_mode as 'warehouse' | 'zone' | 'type') || 'warehouse';

	// Only load service types if in type-based pricing mode
	let serviceTypes: Awaited<ReturnType<typeof getServiceTypes>> = [];
	if (pricingMode === 'type') {
		serviceTypes = await getServiceTypes(supabase);
	}

	return {
		pricingMode,
		serviceTypes
	};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const phone = formData.get('phone') as string;
		const default_pickup_location = formData.get('default_pickup_location') as string;
		const default_service_type_id = formData.get('default_service_type_id') as string;

		if (!name || !email) {
			return fail(400, { error: 'Name and email are required' });
		}

		// Create auth user for client
		const { data: authData, error: authError } = await supabase.auth.admin.createUser({
			email,
			email_confirm: true,
			user_metadata: {
				name,
				role: 'client'
			}
		});

		if (authError) {
			return fail(500, { error: authError.message });
		}

		// Update profile with additional data
		if (authData.user) {
			await supabase
				.from('profiles')
				.update({
					phone: phone || null,
					default_pickup_location: default_pickup_location || null,
					default_service_type_id: default_service_type_id || null
				})
				.eq('id', authData.user.id);
		}

		redirect(303, localizeHref('/courier/clients'));
	}
};
```

**Step 2: Create the page component**

Create: `src/routes/courier/clients/new/+page.svelte`

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData, ActionData } from './$types';
	import { ArrowLeft, Package } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let defaultPickupLocation = $state('');
	let defaultServiceTypeId = $state('');
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref('/courier/clients')}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{m.new_client()}</h1>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.client_info()}</Card.Title>
			<Card.Description>{m.new_client_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				{#if form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="name">{m.form_name()} *</Label>
						<Input
							id="name"
							name="name"
							type="text"
							bind:value={name}
							required
							disabled={loading}
						/>
					</div>
					<div class="space-y-2">
						<Label for="email">{m.form_email()} *</Label>
						<Input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							required
							disabled={loading}
						/>
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="phone">{m.form_phone()}</Label>
						<Input
							id="phone"
							name="phone"
							type="tel"
							bind:value={phone}
							disabled={loading}
						/>
					</div>
					<div class="space-y-2">
						<Label for="location">{m.clients_default_location()}</Label>
						<Input
							id="location"
							name="default_pickup_location"
							type="text"
							bind:value={defaultPickupLocation}
							disabled={loading}
						/>
					</div>
				</div>

				{#if data.pricingMode === 'type' && data.serviceTypes.length > 0}
					<div class="space-y-2">
						<Label for="default_service_type_id">
							<span class="flex items-center gap-2">
								<Package class="size-4 text-muted-foreground" />
								{m.default_service_type()}
							</span>
						</Label>
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

				<div class="flex gap-3 pt-4">
					<Button type="submit" disabled={loading || !name || !email}>
						{loading ? m.saving() : m.action_save()}
					</Button>
					<Button
						type="button"
						variant="outline"
						href={localizeHref('/courier/clients')}
						disabled={loading}
					>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
```

**Step 3: Add missing i18n keys if needed**

Add to both message files if not present:
```json
"new_client": "New Client",
"new_client_desc": "Create a new client account"
```

**Step 4: Run type check**

Run: `pnpm run check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/courier/clients/new/+page.svelte \
        src/routes/courier/clients/new/+page.server.ts
git commit -m "$(cat <<'EOF'
feat(clients): add new client creation form

Creates /courier/clients/new route with:
- Name, email, phone, default location fields
- Default service type selector (type-based pricing mode)
- Auth user creation on submit

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

**Step 1: Run full type check**

```bash
pnpm run check
```

**Step 2: Run dev server and test manually**

```bash
pnpm run dev
```

Test checklist:
- [ ] Switch to type-based pricing mode in settings
- [ ] Create a service type
- [ ] Select distribution zones
- [ ] Create new client with default service type
- [ ] Create service as courier - verify price preview
- [ ] Create service as client - verify zone badge and estimate
- [ ] View service details - verify price breakdown
- [ ] Edit service - verify type-based fields work

**Step 3: Final commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
chore: complete type-based pricing audit fixes

Fixes all HIGH/MEDIUM findings from PR #7 audit:
- H1: New client form with service type selector
- H2: TimePreferencePicker shows warning on expansion
- H3: Service details shows detailed price breakdown
- H4: Zone detection has manual override fallback
- M2: Client form has zone indicator badge
- M4: Price display respects visibility settings
- M5: Courier form has live price preview
- M6: Client form has price estimate section
- L1: Added missing i18n keys
- L3: Service edit form supports type-based fields

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add missing i18n keys | messages/*.json |
| 2 | Service details price breakdown | services/[id]/+page.svelte |
| 3 | Manual zone override | ZoneOverrideToggle.svelte, client/new, courier/new |
| 4 | TimePreferencePicker warning | TimePreferencePicker.svelte |
| 5 | Zone badge on client form | client/new/+page.svelte |
| 6 | Price estimate on client form | client/new/+page.svelte, +page.ts |
| 7 | Live price preview on courier form | TypePricePreview.svelte, courier/new |
| 8 | Service edit type-based fields | services/[id]/edit/* |
| 9 | Price visibility setting checks | courier/new, client/new |
| 10 | New client creation form | clients/new/* |
