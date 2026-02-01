<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import TimePreferencePicker from '$lib/components/TimePreferencePicker.svelte';
	import UrgencyFeeSelect from '$lib/components/UrgencyFeeSelect.svelte';
	import { type ServiceDistanceResult } from '$lib/services/distance.js';
	import { calculateRouteIfReady as calculateRouteShared } from '$lib/services/route.js';
	import {
		getCourierPricingSettings,
		type CourierPricingSettings
	} from '$lib/services/pricing.js';
	import { isInDistributionZone, getClientDefaultServiceTypeId } from '$lib/services/type-pricing.js';
	import { extractMunicipalityFromAddress } from '$lib/services/municipality.js';
	import * as m from '$lib/paraglide/messages.js';
	import { formatCurrency } from '$lib/utils.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { ArrowLeft } from '@lucide/svelte';
	import ZoneOverrideToggle from '$lib/components/ZoneOverrideToggle.svelte';
	import TypePricePreview from '$lib/components/TypePricePreview.svelte';
	import type { PageData } from './$types';
	import type { TimeSlot, UrgencyFee, ServiceType, Profile } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	type ClientOption = Pick<Profile, 'id' | 'name' | 'default_pickup_location' | 'default_service_type_id'>;

	let clients = $state<ClientOption[]>([]);
	let loading = $state(true);

	// Form state
	let selectedClientId = $state('');
	let pickupLocation = $state('');
	let deliveryLocation = $state('');
	let notes = $state('');
	let recipientName = $state('');
	let recipientPhone = $state('');
	let customerReference = $state('');
	let formLoading = $state(false);
	let formError = $state('');
	let formWarning = $state('');

	// Coordinates and distance
	let pickupCoords = $state<[number, number] | null>(null);
	let deliveryCoords = $state<[number, number] | null>(null);
	let routeGeometry = $state<string | null>(null);
	let distanceKm = $state<number | null>(null);
	let durationMinutes = $state<number | null>(null);
	let calculatingDistance = $state(false);
	let distanceResult = $state<ServiceDistanceResult | null>(null);
	let routeSource = $state<'api' | 'haversine' | null>(null);

	// Schedule (traditional mode)
	let scheduledDate = $state<string | null>(null);
	let scheduledTimeSlot = $state<TimeSlot | null>(null);
	let scheduledTime = $state<string | null>(null);

	// Urgency fees and pricing settings
	let urgencyFees = $state<UrgencyFee[]>([]);
	let selectedUrgencyFeeId = $state<string>('');
	let courierSettings = $state<CourierPricingSettings | null>(null);

	// Type-based pricing state
	let selectedServiceTypeId = $state<string>('');
	let hasTimePreference = $state(false);
	let isOutOfZone = $state<boolean | null>(null);
	let detectedMunicipality = $state<string | null>(null);
	let tolls = $state<number | null>(null);
	let checkingZone = $state(false);

	// Derived: is type-based pricing mode
	const isTypePricingMode = $derived(data.pricingMode === 'type');

	// Derived: get selected service type details
	const selectedServiceType = $derived(
		data.serviceTypes.find((st: ServiceType) => st.id === selectedServiceTypeId)
	);

	async function loadData() {
		loading = true;

		const [clientsResult, feesResult, settings] = await Promise.all([
			data.supabase
				.from('profiles')
				.select('id, name, default_pickup_location, default_service_type_id')
				.eq('role', 'client')
				.eq('active', true)
				.order('name'),
			data.supabase.from('urgency_fees').select('*').eq('active', true).order('sort_order'),
			getCourierPricingSettings(data.supabase)
		]);

		clients = clientsResult.data || [];
		urgencyFees = (feesResult.data || []) as UrgencyFee[];
		courierSettings = settings;
		selectedUrgencyFeeId = settings.defaultUrgencyFeeId || '';

		// Set default service type if in type mode
		if (isTypePricingMode && data.serviceTypes.length > 0) {
			selectedServiceTypeId = data.serviceTypes[0].id;
		}

		loading = false;
	}

	function handleFormSubmit() {
		formLoading = true;
		formError = '';
		formWarning = '';
		return async ({ result }: { result: { type: string; data?: { error?: string; success?: boolean; warning?: string } } }) => {
			if (result.type === 'failure' && result.data?.error) {
				formError = result.data.error;
				formLoading = false;
			} else if (result.type === 'success' && result.data?.success) {
				const params = result.data.warning ? `?warning=${encodeURIComponent(result.data.warning)}` : '';
				goto(localizeHref('/courier/services') + params);
			} else {
				formLoading = false;
			}
		};
	}

	async function handleClientSelect() {
		const client = clients.find((c) => c.id === selectedClientId);
		if (client?.default_pickup_location) {
			pickupLocation = client.default_pickup_location;
			pickupCoords = null;
		}
		// Set client's default service type if available
		if (isTypePricingMode && client?.default_service_type_id) {
			selectedServiceTypeId = client.default_service_type_id;
		}
	}

	function handlePickupSelect(address: string, coords: [number, number] | null) {
		pickupLocation = address;
		pickupCoords = coords;
		calculateRouteIfReady();
	}

	async function handleDeliverySelect(address: string, coords: [number, number] | null) {
		deliveryLocation = address;
		deliveryCoords = coords;
		calculateRouteIfReady();

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

		// Extract municipality using shared utility
		const municipality = extractMunicipalityFromAddress(address);
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

	async function calculateRouteIfReady() {
		calculatingDistance = true;
		const result = await calculateRouteShared(pickupCoords, deliveryCoords, courierSettings);
		distanceKm = result.distanceKm;
		durationMinutes = result.durationMinutes;
		routeGeometry = result.routeGeometry;
		distanceResult = result.distanceResult;
		routeSource = result.source;
		calculatingDistance = false;
	}

	// Handle time preference change from TimePreferencePicker
	function handleDateChange(date: string | null) {
		scheduledDate = date;
	}

	function handleTimeSlotChange(slot: TimeSlot | null) {
		scheduledTimeSlot = slot;
		// Update hasTimePreference when slot is selected
		hasTimePreference = slot !== null;
	}

	function handleTimeChange(time: string | null) {
		scheduledTime = time;
	}

	$effect(() => {
		loadData();
	});
</script>

<div class="min-w-0 space-y-6">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="icon" href={localizeHref('/courier/services')}>
			<ArrowLeft class="size-5" />
		</Button>
		<h1 class="text-2xl font-bold">{m.services_create()}</h1>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<p class="text-muted-foreground">{m.loading()}</p>
		</div>
	{:else}
		<Card.Root>
			<Card.Content class="pt-6">
				<form method="POST" action="?/createService" use:enhance={handleFormSubmit} class="space-y-4">
					{#if formError}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{formError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="client">{m.form_client()} *</Label>
						<select
							id="client"
							name="client_id"
							bind:value={selectedClientId}
							onchange={handleClientSelect}
							required
							disabled={formLoading}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						>
							<option value="">{m.form_select_client()}</option>
							{#each clients as client (client.id)}
								<option value={client.id}>{client.name}</option>
							{/each}
						</select>
					</div>

					<!-- Service Type Selector (Type-based pricing only) -->
					{#if isTypePricingMode && data.serviceTypes.length > 0}
						<div class="space-y-2">
							<Label for="service_type">{m.service_type()} *</Label>
							<select
								id="service_type"
								name="service_type_id"
								bind:value={selectedServiceTypeId}
								required
								disabled={formLoading}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
							>
								{#each data.serviceTypes as serviceType (serviceType.id)}
									<option value={serviceType.id}>
										{serviceType.name} - {formatCurrency(serviceType.price)}
									</option>
								{/each}
							</select>
							{#if selectedServiceType?.description}
								<p class="text-xs text-muted-foreground">{selectedServiceType.description}</p>
							{/if}
						</div>
					{/if}

					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="pickup">{m.form_pickup_location()} *</Label>
							<AddressInput
								id="pickup"
								bind:value={pickupLocation}
								onSelect={handlePickupSelect}
								placeholder={m.form_pickup_placeholder()}
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="delivery">{m.form_delivery_location()} *</Label>
							<AddressInput
								id="delivery"
								bind:value={deliveryLocation}
								onSelect={handleDeliverySelect}
								placeholder={m.form_delivery_placeholder()}
								disabled={formLoading}
							/>
							<!-- Zone status indicator with manual override (Type-based pricing only) -->
							{#if isTypePricingMode && deliveryLocation}
								<ZoneOverrideToggle
									{isOutOfZone}
									{detectedMunicipality}
									{checkingZone}
									onOverride={(outOfZone) => (isOutOfZone = outOfZone)}
									disabled={formLoading}
								/>
							{/if}
						</div>
					</div>

					<!-- Route Map Preview -->
					{#if pickupCoords || deliveryCoords}
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
							{:else if routeSource === 'haversine' && distanceKm !== null}
								<p class="text-sm text-amber-600">{m.route_calculation_fallback()}</p>
							{/if}
						</div>
					{/if}

					<Separator />

					<!-- Recipient Section -->
					<div class="space-y-4">
						<h3 class="text-sm font-medium text-muted-foreground">{m.recipient_optional()}</h3>
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="recipient_name">{m.recipient_name()}</Label>
								<Input
									id="recipient_name"
									name="recipient_name"
									bind:value={recipientName}
									placeholder={m.recipient_name_placeholder()}
									disabled={formLoading}
								/>
							</div>
							<div class="space-y-2">
								<Label for="recipient_phone">{m.recipient_phone()}</Label>
								<Input
									id="recipient_phone"
									name="recipient_phone"
									type="tel"
									bind:value={recipientPhone}
									placeholder={m.recipient_phone_placeholder()}
									disabled={formLoading}
								/>
							</div>
						</div>
					</div>

					<!-- Customer Reference -->
					<div class="space-y-2">
						<Label for="customer_reference">{m.customer_reference()}</Label>
						<Input
							id="customer_reference"
							name="customer_reference"
							bind:value={customerReference}
							placeholder={m.customer_reference_placeholder()}
							disabled={formLoading}
						/>
						<p class="text-xs text-muted-foreground">{m.customer_reference_help()}</p>
					</div>

					<Separator />

					<!-- Schedule / Time Preference -->
					<div class="space-y-2">
						{#if isTypePricingMode}
							<!-- Use TimePreferencePicker for type-based pricing -->
							<Label>{m.schedule_optional()}</Label>
							<TimePreferencePicker
								selectedDate={scheduledDate}
								selectedTimeSlot={scheduledTimeSlot}
								selectedTime={scheduledTime}
								onDateChange={handleDateChange}
								onTimeSlotChange={handleTimeSlotChange}
								onTimeChange={handleTimeChange}
								disabled={formLoading}
								showPriceWarning={true}
								basePrice={selectedServiceType?.price ?? 0}
								timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
								isOutOfZone={isOutOfZone === true}
							/>
						{:else}
							<!-- Use traditional SchedulePicker -->
							<Label>{m.schedule_optional()}</Label>
							<SchedulePicker
								selectedDate={scheduledDate}
								selectedTimeSlot={scheduledTimeSlot}
								selectedTime={scheduledTime}
								onDateChange={(date) => (scheduledDate = date)}
								onTimeSlotChange={(slot) => (scheduledTimeSlot = slot)}
								onTimeChange={(time) => (scheduledTime = time)}
								disabled={formLoading}
							/>
						{/if}
					</div>

					<!-- Tolls Input (Type-based pricing, out-of-zone only) -->
					{#if isTypePricingMode && isOutOfZone === true}
						<Separator />
						<div class="space-y-2">
							<Label for="tolls">{m.tolls_label()}</Label>
							<Input
								id="tolls"
								name="tolls"
								type="number"
								step="0.01"
								min="0"
								placeholder={m.tolls_placeholder()}
								bind:value={tolls}
								disabled={formLoading}
							/>
							<p class="text-xs text-muted-foreground">
								{m.tolls_description()}
							</p>
						</div>
					{/if}

					<Separator />

					<!-- Urgency fee selection (only for non-type-based pricing) -->
					{#if !isTypePricingMode}
						<div class="space-y-2">
							<Label for="urgency">{m.form_urgency()}</Label>
							<UrgencyFeeSelect fees={urgencyFees} bind:value={selectedUrgencyFeeId} disabled={formLoading} />
						</div>

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

						<Separator />
					{/if}

					<!-- Live Price Preview (type-based pricing only, respects visibility setting) -->
					{#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
						<Separator />
						<TypePricePreview
							settings={data.typePricingSettings}
							serviceType={selectedServiceType}
							{isOutOfZone}
							{hasTimePreference}
							{distanceKm}
							tolls={tolls}
						/>
					{/if}

					<div class="space-y-2">
						<Label for="notes">{m.form_notes()}</Label>
						<Input
							id="notes"
							name="notes"
							type="text"
							bind:value={notes}
							disabled={formLoading}
						/>
					</div>

					<!-- Hidden fields for form submission -->
					<input type="hidden" name="pickup_location" value={pickupLocation} />
					<input type="hidden" name="delivery_location" value={deliveryLocation} />
					<input type="hidden" name="pickup_lat" value={pickupCoords?.[1] ?? ''} />
					<input type="hidden" name="pickup_lng" value={pickupCoords?.[0] ?? ''} />
					<input type="hidden" name="delivery_lat" value={deliveryCoords?.[1] ?? ''} />
					<input type="hidden" name="delivery_lng" value={deliveryCoords?.[0] ?? ''} />
					<input type="hidden" name="scheduled_date" value={scheduledDate ?? ''} />
					<input type="hidden" name="scheduled_time_slot" value={scheduledTimeSlot ?? ''} />
					<input type="hidden" name="scheduled_time" value={scheduledTime ?? ''} />

					<!-- Type-based pricing hidden fields -->
					{#if isTypePricingMode}
						<input type="hidden" name="has_time_preference" value={hasTimePreference} />
						<input type="hidden" name="is_out_of_zone" value={isOutOfZone ?? false} />
						<input type="hidden" name="detected_municipality" value={detectedMunicipality ?? ''} />
					{/if}

					<div class="flex gap-2">
						<Button variant="outline" href={localizeHref('/courier/services')}>
							{m.services_cancel()}
						</Button>
						<Button type="submit" disabled={formLoading || !selectedClientId || !pickupLocation || !deliveryLocation || (scheduledTimeSlot === 'specific' && !scheduledTime) || (isTypePricingMode && !selectedServiceTypeId)}>
							{formLoading ? m.services_creating() : m.services_create()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
