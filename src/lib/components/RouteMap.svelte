<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import { decodePolyline } from '$lib/services/distance.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		pickupCoords?: [number, number] | null; // [lng, lat]
		deliveryCoords?: [number, number] | null; // [lng, lat]
		routeGeometry?: string | null; // Encoded polyline
		distanceKm?: number | null;
		durationMinutes?: number | null;
		height?: string;
		hideFooter?: boolean;
	}

	let {
		pickupCoords = null,
		deliveryCoords = null,
		routeGeometry = null,
		distanceKm = null,
		durationMinutes = null,
		height = '300px',
		hideFooter = false
	}: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = $state(null);
	let mapLoaded = $state(false);

	// Default center (Lisbon)
	const DEFAULT_CENTER: [number, number] = [-9.1393, 38.7223];
	const DEFAULT_ZOOM = 12;

	onMount(() => {
		if (!PUBLIC_MAPBOX_TOKEN) {
			console.warn('Mapbox token not configured');
			return;
		}

		// Dynamic import to avoid SSR issues
		import('mapbox-gl').then(async (mapboxgl) => {
			await import('mapbox-gl/dist/mapbox-gl.css');

			mapboxgl.default.accessToken = PUBLIC_MAPBOX_TOKEN;

			map = new mapboxgl.default.Map({
				container: mapContainer,
				style: 'mapbox://styles/mapbox/streets-v12',
				center: DEFAULT_CENTER,
				zoom: DEFAULT_ZOOM
			});

			map.on('load', () => {
				mapLoaded = true;
				updateMapContent(pickupCoords, deliveryCoords, routeGeometry);
			});

			map.addControl(new mapboxgl.default.NavigationControl(), 'top-right');
		});

		return () => {
			map?.remove();
		};
	});

	// Update map when coordinates change
	// Props must be read synchronously in $effect to be tracked as dependencies
	// (reads after await in async functions are not tracked - see Svelte 5 await_reactivity_loss)
	$effect(() => {
		if (mapLoaded && map) {
			updateMapContent(pickupCoords, deliveryCoords, routeGeometry);
		}
	});

	async function updateMapContent(
		pickup: [number, number] | null,
		delivery: [number, number] | null,
		geometry: string | null
	) {
		if (!map || !mapLoaded) return;

		const mapboxgl = await import('mapbox-gl');

		// Remove existing markers and route
		const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
		existingMarkers.forEach((marker) => marker.remove());

		if (map.getSource('route')) {
			map.removeLayer('route');
			map.removeSource('route');
		}

		const bounds = new mapboxgl.default.LngLatBounds();
		let hasMarkers = false;

		// Add pickup marker
		if (pickup) {
			const pickupMarker = document.createElement('div');
			pickupMarker.className = 'size-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center';
			pickupMarker.innerHTML = '<span class="text-white text-xs font-bold">P</span>';

			new mapboxgl.default.Marker({ element: pickupMarker })
				.setLngLat(pickup)
				.addTo(map);

			bounds.extend(pickup);
			hasMarkers = true;
		}

		// Add delivery marker
		if (delivery) {
			const deliveryMarker = document.createElement('div');
			deliveryMarker.className = 'size-6 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center';
			deliveryMarker.innerHTML = '<span class="text-white text-xs font-bold">E</span>';

			new mapboxgl.default.Marker({ element: deliveryMarker })
				.setLngLat(delivery)
				.addTo(map);

			bounds.extend(delivery);
			hasMarkers = true;
		}

		// Add route line
		if (geometry && pickup && delivery) {
			const coordinates = decodePolyline(geometry);

			map.addSource('route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'LineString',
						coordinates
					}
				}
			});

			map.addLayer({
				id: 'route',
				type: 'line',
				source: 'route',
				layout: {
					'line-join': 'round',
					'line-cap': 'round'
				},
				paint: {
					'line-color': '#3b82f6',
					'line-width': 4,
					'line-opacity': 0.8
				}
			});

			// Extend bounds to include route
			coordinates.forEach((coord) => bounds.extend(coord as [number, number]));
		}

		// Fit map to bounds if we have markers
		if (hasMarkers) {
			map.fitBounds(bounds, {
				padding: 50,
				maxZoom: 14
			});
		}
	}

	function openDirections() {
		if (pickupCoords && deliveryCoords) {
			// Open in Google Maps
			const url = `https://www.google.com/maps/dir/?api=1&origin=${pickupCoords[1]},${pickupCoords[0]}&destination=${deliveryCoords[1]},${deliveryCoords[0]}`;
			window.open(url, '_blank');
		}
	}
</script>

<div class="space-y-2">
	<div
		bind:this={mapContainer}
		class="w-full rounded-lg overflow-hidden"
		style="height: {height}"
	></div>

	{#if !hideFooter && (distanceKm !== null || (pickupCoords && deliveryCoords))}
		<div class="flex items-center justify-between">
			{#if distanceKm !== null}
				<span class="text-sm text-muted-foreground">
					{#if durationMinutes !== null}
						{m.map_distance_duration({ km: distanceKm.toFixed(1), minutes: String(Math.round(durationMinutes)) })}
					{:else}
						{m.map_distance({ km: distanceKm.toFixed(1) })}
					{/if}
				</span>
			{:else}
				<span></span>
			{/if}

			{#if pickupCoords && deliveryCoords}
				<button
					type="button"
					class="text-sm text-primary hover:underline"
					onclick={openDirections}
				>
					{m.map_get_directions()} →
				</button>
			{/if}
		</div>
	{/if}
</div>
