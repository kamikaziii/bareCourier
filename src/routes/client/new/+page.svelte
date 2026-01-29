<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import TimePreferencePicker from '$lib/components/TimePreferencePicker.svelte';
	import UrgencyFeeSelect from '$lib/components/UrgencyFeeSelect.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import { type ServiceDistanceResult } from '$lib/services/distance.js';
	import { calculateRouteIfReady as calculateRouteShared } from '$lib/services/route.js';
	import {
		getCourierPricingSettings,
		type CourierPricingSettings
	} from '$lib/services/pricing.js';
	import { isInDistributionZone } from '$lib/services/type-pricing.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { TimeSlot, UrgencyFee } from '$lib/database.types.js';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import { AlertTriangle } from '@lucide/svelte';

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
	let durationMinutes = $state<number | null>(null);
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
	let selectedUrgencyFeeId = $state<string>(''); // Empty string = Standard (no urgency)
	let courierSettings = $state<CourierPricingSettings | null>(null);
	let settingsLoaded = $state(false);

	// Type-based pricing state
	let hasTimePreference = $state(false);
	let isOutOfZone = $state<boolean | null>(null);
	let detectedMunicipality = $state<string | null>(null);
	let checkingZone = $state(false);

	// Derived: is type-based pricing mode
	const isTypePricingMode = $derived(data.pricingMode === 'type');

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
		selectedUrgencyFeeId = settings.defaultUrgencyFeeId || ''; // Empty string = Standard
		settingsLoaded = true;
	}

	function handlePickupSelect(address: string, coords: [number, number] | null) {
		pickupLocation = address;
		pickupCoords = coords;
		calculateDistanceIfReady();
	}

	async function handleDeliverySelect(address: string, coords: [number, number] | null) {
		deliveryLocation = address;
		deliveryCoords = coords;
		calculateDistanceIfReady();

		// If type-based pricing, detect municipality and check zone
		if (isTypePricingMode && address) {
			await detectMunicipalityAndCheckZone(address);
		}
	}

	/**
	 * Extract municipality (concelho) from Mapbox address and check if in zone
	 */
	async function detectMunicipalityAndCheckZone(address: string) {
		checkingZone = true;

		// Try to extract municipality from address
		// Mapbox addresses for Portugal typically include the municipality
		// Format: "Street, Postal Code, Municipality, District, Portugal"
		const parts = address.split(',').map((p) => p.trim());

		let municipality: string | null = null;

		if (parts.length >= 4) {
			// Try the 3rd from last (skipping Portugal and District)
			const potentialMunicipality = parts[parts.length - 3];
			// Check if it looks like a municipality (not a postal code)
			if (potentialMunicipality && !/^\d{4}/.test(potentialMunicipality)) {
				municipality = potentialMunicipality;
			}
		}

		if (!municipality && parts.length >= 3) {
			// Fallback: try 2nd from last
			const potentialMunicipality = parts[parts.length - 2];
			if (potentialMunicipality && !/^\d{4}/.test(potentialMunicipality)) {
				municipality = potentialMunicipality;
			}
		}

		detectedMunicipality = municipality;

		// Check if municipality is in distribution zone
		if (municipality) {
			const inZone = await isInDistributionZone(data.supabase, municipality);
			isOutOfZone = !inZone;
		} else {
			// Cannot determine, default to null (unknown)
			isOutOfZone = null;
		}

		checkingZone = false;
	}

	async function calculateDistanceIfReady() {
		calculatingDistance = true;
		const result = await calculateRouteShared(pickupCoords, deliveryCoords, courierSettings);
		distanceKm = result.distanceKm;
		durationMinutes = result.durationMinutes;
		routeGeometry = result.routeGeometry;
		distanceResult = result.distanceResult;
		calculatingDistance = false;
	}

	function handleFormSubmit() {
		loading = true;
		error = '';
		return async ({ result }: { result: { type: string; data?: { error?: string } } }) => {
			if (result.type === 'failure' && result.data?.error) {
				error = result.data.error;
				loading = false;
			} else if (result.type === 'redirect') {
				// Redirect is handled automatically by SvelteKit
			} else {
				loading = false;
			}
		};
	}
</script>

<div class="max-w-md mx-auto space-y-6">
	<div>
		<h1 class="text-2xl font-bold">{m.client_new_title()}</h1>
		<p class="text-muted-foreground">{m.client_new_subtitle()}</p>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<form method="POST" use:enhance={handleFormSubmit} class="space-y-4">
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
							{durationMinutes}
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

				<!-- Schedule / Time Preference -->
				<div class="space-y-2">
					{#if isTypePricingMode}
						<!-- Use TimePreferencePicker for type-based pricing -->
						<h3 class="font-medium text-sm text-muted-foreground">{m.schedule_optional()}</h3>
						<TimePreferencePicker
							selectedDate={requestedDate}
							selectedTimeSlot={requestedTimeSlot}
							selectedTime={requestedTime}
							onDateChange={(date) => (requestedDate = date)}
							onTimeSlotChange={(slot) => {
								requestedTimeSlot = slot;
								hasTimePreference = slot !== null;
							}}
							onTimeChange={(time) => (requestedTime = time)}
							disabled={loading}
							showPriceWarning={true}
							basePrice={0}
							timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
						/>

						<!-- Out-of-zone warning -->
						{#if isOutOfZone === true}
							<div class="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
								<AlertTriangle class="mt-0.5 size-4 shrink-0" />
								<span>{m.out_of_zone_client_warning()}</span>
							</div>
						{/if}
					{:else}
						<!-- Use traditional SchedulePicker -->
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
					{/if}
				</div>

				<!-- Urgency fee selection (only for non-type-based pricing) -->
				{#if !isTypePricingMode && settingsLoaded}
					<Separator />
					<div class="space-y-2">
						<Label for="urgency">{m.form_urgency()}</Label>
						<UrgencyFeeSelect fees={urgencyFees} bind:value={selectedUrgencyFeeId} disabled={loading} />
					</div>
				{/if}

				<!-- Distance breakdown for warehouse mode (only for non-type-based pricing) -->
				{#if !isTypePricingMode && distanceResult?.distanceMode === 'warehouse' && distanceResult.warehouseToPickupKm}
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

				<!-- Hidden fields for form submission -->
				<input type="hidden" name="pickup_location" value={pickupLocation} />
				<input type="hidden" name="delivery_location" value={deliveryLocation} />
				<input type="hidden" name="notes" value={notes} />
				<input type="hidden" name="pickup_lat" value={pickupCoords?.[1] ?? ''} />
				<input type="hidden" name="pickup_lng" value={pickupCoords?.[0] ?? ''} />
				<input type="hidden" name="delivery_lat" value={deliveryCoords?.[1] ?? ''} />
				<input type="hidden" name="delivery_lng" value={deliveryCoords?.[0] ?? ''} />
				<input type="hidden" name="requested_date" value={requestedDate ?? ''} />
				<input type="hidden" name="requested_time_slot" value={requestedTimeSlot ?? ''} />
				<input type="hidden" name="requested_time" value={requestedTime ?? ''} />

				<!-- Type-based pricing hidden fields -->
				{#if isTypePricingMode}
					<input type="hidden" name="has_time_preference" value={hasTimePreference} />
					<input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? false} />
					<input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
				{/if}

				<div class="flex gap-2 pt-2">
					<Button type="button" variant="outline" class="flex-1" onclick={() => goto(localizeHref('/client'))}>
						{m.services_cancel()}
					</Button>
					<Button type="submit" class="flex-1" disabled={loading || !pickupLocation || !deliveryLocation || (requestedTimeSlot === 'specific' && !requestedTime)}>
						{loading ? m.services_creating() : m.client_create_request()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
