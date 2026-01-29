<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import UrgencyFeeSelect from '$lib/components/UrgencyFeeSelect.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { calculateRouteIfReady as calculateRouteShared } from '$lib/services/route.js';
	import { getCourierPricingSettings } from '$lib/services/pricing.js';
	import type { PageData, ActionData } from './$types';
	import type { TimeSlot, UrgencyFee } from '$lib/database.types.js';
	import { ArrowLeft } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form editing
	let clientId = $state(data.service.client_id);
	// svelte-ignore state_referenced_locally
	let pickupLocation = $state(data.service.pickup_location);
	// svelte-ignore state_referenced_locally
	let deliveryLocation = $state(data.service.delivery_location);
	// svelte-ignore state_referenced_locally
	let notes = $state(data.service.notes || '');

	// Coordinates and distance
	// svelte-ignore state_referenced_locally
	let pickupCoords = $state<[number, number] | null>(
		data.service.pickup_lng && data.service.pickup_lat
			? [data.service.pickup_lng, data.service.pickup_lat]
			: null
	);
	// svelte-ignore state_referenced_locally
	let deliveryCoords = $state<[number, number] | null>(
		data.service.delivery_lng && data.service.delivery_lat
			? [data.service.delivery_lng, data.service.delivery_lat]
			: null
	);
	let routeGeometry = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let distanceKm = $state<number | null>(data.service.distance_km);
	let durationMinutes = $state<number | null>(null);
	let calculatingDistance = $state(false);

	// Schedule
	// svelte-ignore state_referenced_locally
	let scheduledDate = $state<string | null>(data.service.scheduled_date);
	// svelte-ignore state_referenced_locally
	let scheduledTimeSlot = $state<TimeSlot | null>(data.service.scheduled_time_slot as TimeSlot | null);
	// svelte-ignore state_referenced_locally
	let scheduledTime = $state<string | null>(data.service.scheduled_time || null);

	// Urgency fees
	let urgencyFees = $state<UrgencyFee[]>([]);
	// svelte-ignore state_referenced_locally
	let selectedUrgencyFeeId = $state<string>(data.service.urgency_fee_id || '');

	// Load urgency fees
	$effect(() => {
		data.supabase
			.from('urgency_fees')
			.select('*')
			.eq('active', true)
			.order('sort_order')
			.then(({ data: fees }) => {
				urgencyFees = (fees || []) as UrgencyFee[];
			});
	});

	// Load initial route on mount if coords already exist (e.g. editing existing service)
	let hasMountedRoute = false;
	$effect(() => {
		if (!hasMountedRoute) {
			hasMountedRoute = true;
			if (pickupCoords && deliveryCoords) {
				calculateRouteIfReady();
			}
		}
	});

	function handleClientChange() {
		const client = data.clients.find((c) => c.id === clientId);
		if (client?.default_pickup_location && !pickupLocation) {
			pickupLocation = client.default_pickup_location;
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
		const settings = await getCourierPricingSettings(data.supabase);
		const result = await calculateRouteShared(pickupCoords, deliveryCoords, settings);
		distanceKm = result.distanceKm;
		durationMinutes = result.durationMinutes;
		routeGeometry = result.routeGeometry;
		calculatingDistance = false;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref(`/courier/services/${data.service.id}`)}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{m.edit_service()}</h1>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.service_details()}</Card.Title>
			<Card.Description>{m.edit_service_desc()}</Card.Description>
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

				<div class="space-y-2">
					<Label for="client">{m.form_client()} *</Label>
					<select
						id="client"
						name="client_id"
						bind:value={clientId}
						onchange={handleClientChange}
						required
						disabled={loading}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
					>
						<option value="">{m.form_select_client()}</option>
						{#each data.clients as client (client.id)}
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
							disabled={loading}
						/>
					</div>
					<div class="space-y-2">
						<Label for="delivery">{m.form_delivery_location()} *</Label>
						<AddressInput
							id="delivery"
							bind:value={deliveryLocation}
							onSelect={handleDeliverySelect}
							placeholder={m.form_delivery_placeholder()}
							disabled={loading}
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
							{durationMinutes}
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
						disabled={loading}
					/>
				</div>

				<Separator />

				<!-- Urgency fee selection -->
				<div class="space-y-2">
					<Label for="urgency">{m.form_urgency()}</Label>
					<UrgencyFeeSelect fees={urgencyFees} bind:value={selectedUrgencyFeeId} disabled={loading} />
				</div>

				<Separator />

				<div class="space-y-2">
					<Label for="notes">{m.form_notes_optional()}</Label>
					<Input id="notes" name="notes" type="text" bind:value={notes} disabled={loading} />
				</div>

				<!-- Hidden fields for form submission -->
				<input type="hidden" name="pickup_location" value={pickupLocation} />
				<input type="hidden" name="delivery_location" value={deliveryLocation} />
				<input type="hidden" name="pickup_lat" value={pickupCoords?.[1] ?? ''} />
				<input type="hidden" name="pickup_lng" value={pickupCoords?.[0] ?? ''} />
				<input type="hidden" name="delivery_lat" value={deliveryCoords?.[1] ?? ''} />
				<input type="hidden" name="delivery_lng" value={deliveryCoords?.[0] ?? ''} />
				<input type="hidden" name="distance_km" value={distanceKm ?? ''} />
				<input type="hidden" name="scheduled_date" value={scheduledDate ?? ''} />
				<input type="hidden" name="scheduled_time_slot" value={scheduledTimeSlot ?? ''} />
				<input type="hidden" name="scheduled_time" value={scheduledTime ?? ''} />

				<div class="flex gap-3 pt-4">
					<Button type="submit" disabled={loading || !clientId || !pickupLocation || !deliveryLocation || (scheduledTimeSlot === 'specific' && !scheduledTime)}>
						{loading ? m.saving() : m.action_save()}
					</Button>
					<Button
						type="button"
						variant="outline"
						href={localizeHref(`/courier/services/${data.service.id}`)}
						disabled={loading}
					>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
