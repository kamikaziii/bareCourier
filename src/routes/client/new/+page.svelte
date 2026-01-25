<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import {
		calculateRoute,
		calculateHaversineDistance,
		calculateServiceDistance,
		type ServiceDistanceResult
	} from '$lib/services/distance.js';
	import {
		getCourierPricingSettings,
		type CourierPricingSettings
	} from '$lib/services/pricing.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { TimeSlot, UrgencyFee } from '$lib/database.types.js';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally - intentional: prefill form with user's default location
	const defaultPickup = data.profile?.default_pickup_location || '';
	let pickupLocation = $state(defaultPickup);
	let deliveryLocation = $state('');
	let notes = $state('');
	let loading = $state(false);
	let error = $state('');

	// Coordinates for maps
	let pickupCoords = $state<[number, number] | null>(null);
	let deliveryCoords = $state<[number, number] | null>(null);
	let distanceKm = $state<number | null>(null);
	let routeGeometry = $state<string | null>(null);
	let calculatingDistance = $state(false);

	// Distance breakdown for warehouse mode
	let distanceResult = $state<ServiceDistanceResult | null>(null);

	// Scheduling state
	let requestedDate = $state<string | null>(null);
	let requestedTimeSlot = $state<TimeSlot | null>(null);
	let requestedTime = $state<string | null>(null);

	// Urgency fees and pricing settings
	let urgencyFees = $state<UrgencyFee[]>([]);
	let selectedUrgencyFeeId = $state<string | null>(null);
	let courierSettings = $state<CourierPricingSettings | null>(null);
	let settingsLoaded = $state(false);

	// Whether to show address autocomplete (only if Mapbox is configured)
	const hasMapbox = !!PUBLIC_MAPBOX_TOKEN;

	// Load courier settings and urgency fees on mount
	$effect(() => {
		if (!settingsLoaded) {
			loadSettings();
		}
	});

	async function loadSettings() {
		const [settings, { data: fees }] = await Promise.all([
			getCourierPricingSettings(data.supabase),
			data.supabase.from('urgency_fees').select('*').eq('active', true).order('sort_order')
		]);
		courierSettings = settings;
		urgencyFees = (fees || []) as UrgencyFee[];
		selectedUrgencyFeeId = settings.defaultUrgencyFeeId;
		settingsLoaded = true;
	}

	function handlePickupSelect(address: string, coords: [number, number] | null) {
		pickupLocation = address;
		pickupCoords = coords;
		calculateDistanceIfReady();
	}

	function handleDeliverySelect(address: string, coords: [number, number] | null) {
		deliveryLocation = address;
		deliveryCoords = coords;
		calculateDistanceIfReady();
	}

	async function calculateDistanceIfReady() {
		if (!pickupCoords || !deliveryCoords) return;

		calculatingDistance = true;
		distanceKm = null;
		routeGeometry = null;
		distanceResult = null;

		try {
			// Use service distance calculation with warehouse mode support
			if (courierSettings) {
				const result = await calculateServiceDistance({
					pickupCoords,
					deliveryCoords,
					warehouseCoords: courierSettings.warehouseCoords,
					pricingMode: courierSettings.pricingMode,
					roundDistance: courierSettings.roundDistance
				});
				distanceResult = result;
				distanceKm = result.totalDistanceKm;
			} else {
				// Fallback to direct route calculation
				const result = await calculateRoute(pickupCoords, deliveryCoords);
				if (result) {
					distanceKm = result.distanceKm;
				} else {
					distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
				}
			}

			// Get route geometry for map display
			const routeResult = await calculateRoute(pickupCoords, deliveryCoords);
			routeGeometry = routeResult?.geometry || null;
		} catch {
			// Fallback to Haversine distance
			distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
		}

		calculatingDistance = false;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: insertError } = await data.supabase.from('services').insert({
			client_id: data.session?.user.id,
			pickup_location: pickupLocation,
			delivery_location: deliveryLocation,
			notes: notes || null,
			// Scheduling fields
			requested_date: requestedDate,
			requested_time_slot: requestedTimeSlot,
			requested_time: requestedTime,
			// Coordinates and distance
			pickup_lat: pickupCoords?.[1] ?? null,
			pickup_lng: pickupCoords?.[0] ?? null,
			delivery_lat: deliveryCoords?.[1] ?? null,
			delivery_lng: deliveryCoords?.[0] ?? null,
			distance_km: distanceKm,
			// Urgency fee
			urgency_fee_id: selectedUrgencyFeeId || null
		});

		if (insertError) {
			error = insertError.message;
			loading = false;
			return;
		}

		goto(localizeHref('/client'));
	}
</script>

<div class="max-w-md mx-auto space-y-6">
	<div>
		<h1 class="text-2xl font-bold">{m.client_new_title()}</h1>
		<p class="text-muted-foreground">{m.client_new_subtitle()}</p>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="pickup">{m.form_pickup_location()}</Label>
					{#if hasMapbox}
						<AddressInput
							id="pickup"
							bind:value={pickupLocation}
							onSelect={handlePickupSelect}
							placeholder={m.form_pickup_placeholder()}
							disabled={loading}
						/>
					{:else}
						<Input
							id="pickup"
							type="text"
							placeholder={m.form_pickup_placeholder()}
							bind:value={pickupLocation}
							required
							disabled={loading}
						/>
					{/if}
				</div>

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
						<Input
							id="delivery"
							type="text"
							placeholder={m.form_delivery_placeholder()}
							bind:value={deliveryLocation}
							required
							disabled={loading}
						/>
					{/if}
				</div>

				<!-- Show map preview if both addresses are selected -->
				{#if hasMapbox && pickupCoords && deliveryCoords}
					<div class="space-y-2">
						<Label>{m.map_route()}</Label>
						<RouteMap
							{pickupCoords}
							{deliveryCoords}
							{routeGeometry}
							{distanceKm}
							height="200px"
						/>
						{#if calculatingDistance}
							<p class="text-sm text-muted-foreground">{m.map_calculating()}</p>
						{/if}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="notes">{m.form_notes_optional()}</Label>
					<Input
						id="notes"
						type="text"
						placeholder={m.form_notes_placeholder()}
						bind:value={notes}
						disabled={loading}
					/>
				</div>

				<Separator />

				<div class="space-y-2">
					<h3 class="font-medium text-sm text-muted-foreground">{m.schedule_optional()}</h3>
					<SchedulePicker
						selectedDate={requestedDate}
						selectedTimeSlot={requestedTimeSlot}
						selectedTime={requestedTime}
						onDateChange={(date) => (requestedDate = date)}
						onTimeSlotChange={(slot) => (requestedTimeSlot = slot)}
						onTimeChange={(time) => (requestedTime = time)}
						disabled={loading}
					/>
				</div>

				<!-- Urgency fee selection -->
				{#if urgencyFees.length > 0}
					<Separator />
					<div class="space-y-2">
						<Label for="urgency">{m.form_urgency()}</Label>
						<select
							id="urgency"
							bind:value={selectedUrgencyFeeId}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							disabled={loading}
						>
							{#each urgencyFees as fee (fee.id)}
								<option value={fee.id}>
									{fee.name}
									{#if fee.multiplier > 1 || fee.flat_fee > 0}
										({fee.multiplier}x{fee.flat_fee > 0 ? ` + €${fee.flat_fee}` : ''})
									{/if}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Distance breakdown for warehouse mode -->
				{#if distanceResult?.distanceMode === 'warehouse' && distanceResult.warehouseToPickupKm}
					<div class="rounded-md bg-muted p-3 text-sm space-y-1">
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.distance_warehouse_to_pickup()}</span>
							<span>{distanceResult.warehouseToPickupKm} km</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.distance_pickup_to_delivery()}</span>
							<span>{distanceResult.pickupToDeliveryKm} km</span>
						</div>
						<Separator />
						<div class="flex justify-between font-medium">
							<span>{m.distance_total()}</span>
							<span>{distanceResult.totalDistanceKm} km</span>
						</div>
					</div>
				{/if}

				<div class="flex gap-2 pt-2">
					<Button type="button" variant="outline" class="flex-1" onclick={() => goto(localizeHref('/client'))}>
						{m.services_cancel()}
					</Button>
					<Button type="submit" class="flex-1" disabled={loading || !pickupLocation || !deliveryLocation}>
						{loading ? m.services_creating() : m.client_create_request()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
