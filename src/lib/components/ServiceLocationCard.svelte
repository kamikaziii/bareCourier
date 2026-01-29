<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { MapPin, ChevronDown, Navigation } from '@lucide/svelte';
	import { estimateDrivingMinutes } from '$lib/services/distance.js';
	import { formatMinutesToHuman } from '$lib/utils.js';

	interface ServiceLocation {
		pickup_location: string;
		delivery_location: string;
		pickup_lat: number | null;
		pickup_lng: number | null;
		delivery_lat: number | null;
		delivery_lng: number | null;
		distance_km: number | null;
		duration_minutes: number | null;
	}

	let { service, hasMapbox = false }: { service: ServiceLocation; hasMapbox?: boolean } = $props();

	let showMap = $state(false);

	const hasCoordinates = $derived(
		service.pickup_lat && service.pickup_lng &&
		service.delivery_lat && service.delivery_lng
	);

	const tripTime = $derived(
		service.duration_minutes
			? formatMinutesToHuman(service.duration_minutes)
			: service.distance_km
				? formatMinutesToHuman(estimateDrivingMinutes(service.distance_km))
				: null
	);

	function openNavigation(lat: number, lng: number) {
		const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
		window.open(url, '_blank');
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<MapPin class="size-5" />
			{m.locations()}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div>
			<p class="text-sm font-medium text-muted-foreground">{m.form_pickup_location()}</p>
			<div class="flex items-start justify-between gap-2 mt-1">
				<p class="flex-1">{service.pickup_location}</p>
				{#if service.pickup_lat && service.pickup_lng}
					<Button
						variant="outline"
						size="icon"
						class="size-8 shrink-0"
						onclick={() => openNavigation(service.pickup_lat!, service.pickup_lng!)}
						aria-label={m.navigate_to_location()}
					>
						<Navigation class="size-4" />
					</Button>
				{/if}
			</div>
		</div>
		<Separator />
		<div>
			<p class="text-sm font-medium text-muted-foreground">{m.form_delivery_location()}</p>
			<div class="flex items-start justify-between gap-2 mt-1">
				<p class="flex-1">{service.delivery_location}</p>
				{#if service.delivery_lat && service.delivery_lng}
					<Button
						variant="outline"
						size="icon"
						class="size-8 shrink-0"
						onclick={() => openNavigation(service.delivery_lat!, service.delivery_lng!)}
						aria-label={m.navigate_to_location()}
					>
						<Navigation class="size-4" />
					</Button>
				{/if}
			</div>
		</div>

		<!-- Map Controls & Route Map -->
		{#if hasMapbox && hasCoordinates}
			<Separator />
			<!-- Always visible: distance + map toggle -->
			<div class="flex items-start justify-between gap-2">
				<div class="text-sm text-muted-foreground">
					{#if service.distance_km}
						<div>{m.map_distance({ km: service.distance_km.toFixed(1) })}</div>
					{/if}
					{#if tripTime}
						<div>~{tripTime}</div>
					{/if}
				</div>
				<Button variant="ghost" size="sm" onclick={() => (showMap = !showMap)}>
					{showMap ? m.hide_map() : m.show_map()}
					<ChevronDown class="ml-1 size-4 transition-transform" style={showMap ? 'transform: rotate(180deg)' : ''} />
				</Button>
			</div>

			<!-- Collapsible map only -->
			{#if showMap}
				<RouteMap
					pickupCoords={[service.pickup_lng!, service.pickup_lat!]}
					deliveryCoords={[service.delivery_lng!, service.delivery_lat!]}
					distanceKm={service.distance_km}
					height="250px"
					hideFooter={true}
				/>
			{/if}
		{:else if service.distance_km}
			<!-- Fallback when no map: show distance with time -->
			<Separator />
			<div class="text-sm text-muted-foreground">
				<div>{m.map_distance({ km: service.distance_km.toFixed(1) })}</div>
				{#if tripTime}
					<div>~{tripTime}</div>
				{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
