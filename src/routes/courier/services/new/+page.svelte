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
	import UrgencyFeeSelect from '$lib/components/UrgencyFeeSelect.svelte';
	import { type ServiceDistanceResult } from '$lib/services/distance.js';
	import { calculateRouteIfReady as calculateRouteShared } from '$lib/services/route.js';
	import {
		getCourierPricingSettings,
		type CourierPricingSettings
	} from '$lib/services/pricing.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { ArrowLeft } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { TimeSlot, UrgencyFee } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	let clients = $state<any[]>([]);
	let loading = $state(true);

	// Form state
	let selectedClientId = $state('');
	let pickupLocation = $state('');
	let deliveryLocation = $state('');
	let notes = $state('');
	let formLoading = $state(false);
	let formError = $state('');
	let formWarning = $state('');

	// Coordinates and distance
	let pickupCoords = $state<[number, number] | null>(null);
	let deliveryCoords = $state<[number, number] | null>(null);
	let routeGeometry = $state<string | null>(null);
	let distanceKm = $state<number | null>(null);
	let calculatingDistance = $state(false);
	let distanceResult = $state<ServiceDistanceResult | null>(null);

	// Schedule
	let scheduledDate = $state<string | null>(null);
	let scheduledTimeSlot = $state<TimeSlot | null>(null);
	let scheduledTime = $state<string | null>(null);

	// Urgency fees and pricing settings
	let urgencyFees = $state<UrgencyFee[]>([]);
	let selectedUrgencyFeeId = $state<string>('');
	let courierSettings = $state<CourierPricingSettings | null>(null);

	async function loadData() {
		loading = true;

		const [clientsResult, feesResult, settings] = await Promise.all([
			data.supabase
				.from('profiles')
				.select('id, name, default_pickup_location')
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
				if (result.data.warning) {
					// Store warning in sessionStorage so the list page can show it
					sessionStorage.setItem('serviceFormWarning', result.data.warning);
				}
				goto(localizeHref('/courier/services'));
			} else {
				formLoading = false;
			}
		};
	}

	function handleClientSelect() {
		const client = clients.find((c) => c.id === selectedClientId);
		if (client?.default_pickup_location) {
			pickupLocation = client.default_pickup_location;
			pickupCoords = null;
		}
	}

	function handlePickupSelect(address: string, coords: [number, number] | null) {
		pickupLocation = address;
		pickupCoords = coords;
		calculateRouteIfReady();
	}

	function handleDeliverySelect(address: string, coords: [number, number] | null) {
		deliveryLocation = address;
		deliveryCoords = coords;
		calculateRouteIfReady();
	}

	async function calculateRouteIfReady() {
		calculatingDistance = true;
		const result = await calculateRouteShared(pickupCoords, deliveryCoords, courierSettings);
		distanceKm = result.distanceKm;
		routeGeometry = result.routeGeometry;
		distanceResult = result.distanceResult;
		calculatingDistance = false;
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
								height="200px"
							/>
							{#if calculatingDistance}
								<p class="text-sm text-muted-foreground">{m.map_calculating()}</p>
							{/if}
						</div>
					{/if}

					<Separator />

					<!-- Schedule -->
					<div class="space-y-2">
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
					</div>

					<Separator />

					<!-- Urgency fee selection -->
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

					<div class="flex gap-2">
						<Button variant="outline" href={localizeHref('/courier/services')}>
							{m.services_cancel()}
						</Button>
						<Button type="submit" disabled={formLoading || !selectedClientId || !pickupLocation || !deliveryLocation || (scheduledTimeSlot === 'specific' && !scheduledTime)}>
							{formLoading ? m.services_creating() : m.services_create()}
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
