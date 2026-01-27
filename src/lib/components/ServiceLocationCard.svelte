<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { MapPin } from '@lucide/svelte';

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
			<p class="mt-1">{service.pickup_location}</p>
		</div>
		<Separator />
		<div>
			<p class="text-sm font-medium text-muted-foreground">{m.form_delivery_location()}</p>
			<p class="mt-1">{service.delivery_location}</p>
		</div>

		<!-- Route Map -->
		{#if hasMapbox && service.pickup_lat && service.pickup_lng && service.delivery_lat && service.delivery_lng}
			<Separator />
			<RouteMap
				pickupCoords={[service.pickup_lng, service.pickup_lat]}
				deliveryCoords={[service.delivery_lng, service.delivery_lat]}
				distanceKm={service.distance_km}
				height="250px"
			/>
		{:else if service.distance_km}
			<Separator />
			<p class="text-sm text-muted-foreground">
				{m.map_distance({ km: service.distance_km.toFixed(1) })}
			</p>
		{/if}
	</Card.Content>
</Card.Root>
