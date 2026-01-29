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
				total: Math.round((base + distance + tollCost) * 100) / 100
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
