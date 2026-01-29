<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { MapPin, ChevronDown, Navigation } from '@lucide/svelte';

	interface ServiceLocation {
		pickup_location: string;
		delivery_location: string;
		pickup_lat: number | null;
		pickup_lng: number | null;
		delivery_lat: number | null;
		delivery_lng: number | null;
		distance_km: number | null;
	}

	let { service, hasMapbox = false }: { service: ServiceLocation; hasMapbox?: boolean } = $props();

	let showMap = $state(false);

	const hasCoordinates = $derived(
		service.pickup_lat && service.pickup_lng &&
		service.delivery_lat && service.delivery_lng
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
			<div class="flex items-center justify-between flex-wrap gap-2">
				{#if service.distance_km}
					<span class="text-sm text-muted-foreground">
						{m.map_distance({ km: service.distance_km.toFixed(1) })}
					</span>
				{:else}
					<span></span>
				{/if}
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
			<!-- Fallback when no map: show distance only -->
			<Separator />
			<p class="text-sm text-muted-foreground">
				{m.map_distance({ km: service.distance_km.toFixed(1) })}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
