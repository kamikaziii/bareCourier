<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
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
	import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import { CalendarClock } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { TimeSlot, UrgencyFee } from '$lib/database.types.js';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';

	let { data }: { data: PageData } = $props();

	const pastDueConfig = $derived(settingsToConfig(data.profile.past_due_settings, data.profile.time_slots));

	let services = $state<any[]>([]);
	let clients = $state<any[]>([]);
	let loading = $state(true);

	// Filters
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');
	let clientFilter = $state<string>('all');
	let searchQuery = $state('');

	// New service form
	let showForm = $state(false);
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
	let selectedUrgencyFeeId = $state<string>(''); // Empty string = Standard (no urgency)
	let courierSettings = $state<CourierPricingSettings | null>(null);

	async function loadData() {
		loading = true;

		const [servicesResult, clientsResult, feesResult, settings] = await Promise.all([
			data.supabase
				.from('services')
				.select('*, profiles!client_id(id, name, default_pickup_location)')
				.is('deleted_at', null)
				.order('created_at', { ascending: false }),
			data.supabase
				.from('profiles')
				.select('id, name, default_pickup_location')
				.eq('role', 'client')
				.eq('active', true)
				.order('name'),
			data.supabase.from('urgency_fees').select('*').eq('active', true).order('sort_order'),
			getCourierPricingSettings(data.supabase)
		]);

		services = servicesResult.data || [];
		clients = clientsResult.data || [];
		urgencyFees = (feesResult.data || []) as UrgencyFee[];
		courierSettings = settings;
		selectedUrgencyFeeId = settings.defaultUrgencyFeeId || ''; // Empty string = Standard
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
				// Show warning if present (e.g., no pricing configured)
				if (result.data.warning) {
					formWarning = result.data.warning;
				}
				// Reset form
				showForm = false;
				selectedClientId = '';
				pickupLocation = '';
				deliveryLocation = '';
				notes = '';
				pickupCoords = null;
				deliveryCoords = null;
				routeGeometry = null;
				distanceKm = null;
				distanceResult = null;
				scheduledDate = null;
				scheduledTimeSlot = null;
				scheduledTime = null;
				selectedUrgencyFeeId = courierSettings?.defaultUrgencyFeeId || '';
				formLoading = false;

				await loadData();
			} else {
				formLoading = false;
			}
		};
	}

	function handleClientSelect() {
		const client = clients.find((c) => c.id === selectedClientId);
		if (client?.default_pickup_location) {
			pickupLocation = client.default_pickup_location;
			// Clear coords since this is just text
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
		if (pickupCoords && deliveryCoords) {
			calculatingDistance = true;
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
						// Haversine fallback
						distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
					}
				}

				// Get route geometry for map display
				const routeResult = await calculateRoute(pickupCoords, deliveryCoords);
				routeGeometry = routeResult?.geometry || null;
			} catch {
				// Haversine fallback
				distanceKm = calculateHaversineDistance(pickupCoords, deliveryCoords);
			}

			calculatingDistance = false;
		} else {
			distanceKm = null;
			routeGeometry = null;
			distanceResult = null;
		}
	}

	$effect(() => {
		loadData();
	});

	const filteredServices = $derived(
		sortByUrgency(
			services.filter((s) => {
				if (statusFilter !== 'all' && s.status !== statusFilter) return false;
				if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
				if (searchQuery) {
					const query = searchQuery.toLowerCase();
					const matchesClient = s.profiles?.name?.toLowerCase().includes(query);
					const matchesPickup = s.pickup_location?.toLowerCase().includes(query);
					const matchesDelivery = s.delivery_location?.toLowerCase().includes(query);
					if (!matchesClient && !matchesPickup && !matchesDelivery) return false;
				}
				return true;
			}),
			pastDueConfig
		)
	);

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}
</script>

<PullToRefresh>
<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.services_title()}</h1>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? m.services_cancel() : m.services_new()}
		</Button>
	</div>

	{#if showForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.services_create()}</Card.Title>
			</Card.Header>
			<Card.Content>
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
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
						<select
							id="urgency"
							name="urgency_fee_id"
							bind:value={selectedUrgencyFeeId}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
							disabled={formLoading}
						>
							<option value="">{m.urgency_standard()}</option>
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

					<Button type="submit" disabled={formLoading || !selectedClientId || !pickupLocation || !deliveryLocation || (scheduledTimeSlot === 'specific' && !scheduledTime)}>
						{formLoading ? m.services_creating() : m.services_create()}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Filters -->
	<div class="flex flex-col gap-4 sm:flex-row">
		<div class="flex-1">
			<Input
				type="search"
				placeholder={m.services_search()}
				bind:value={searchQuery}
			/>
		</div>
		<select
			bind:value={statusFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">{m.services_all_status()}</option>
			<option value="pending">{m.status_pending()}</option>
			<option value="delivered">{m.status_delivered()}</option>
		</select>
		<select
			bind:value={clientFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">{m.services_all_clients()}</option>
			{#each clients as client (client.id)}
				<option value={client.id}>{client.name}</option>
			{/each}
		</select>
	</div>

	<!-- Warning message (e.g., no pricing configured) -->
	{#if formWarning}
		<div class="rounded-md bg-amber-500/10 p-3 flex items-center justify-between text-amber-600">
			<span class="text-sm">
				{#if formWarning === 'service_created_no_pricing'}
					{m.service_created_no_pricing()}
				{:else}
					{formWarning}
				{/if}
			</span>
			<button type="button" class="text-amber-600 hover:text-amber-800" onclick={() => (formWarning = '')}>
				✕
			</button>
		</div>
	{/if}

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<SkeletonList variant="service" count={5} />
		{:else if filteredServices.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					{m.services_no_results()}
				</Card.Content>
			</Card.Root>
		{:else}
			<p class="text-sm text-muted-foreground">
				{m.services_showing({ count: filteredServices.length })}
			</p>
			{#each filteredServices as service (service.id)}
				<a href={localizeHref(`/courier/services/${service.id}`)} class="block">
					<Card.Root class="overflow-hidden transition-colors hover:bg-muted/50">
						<Card.Content class="flex items-start gap-3 p-4">
							<div
								class="mt-1.5 size-3 shrink-0 rounded-full {service.status === 'pending'
									? 'bg-blue-500'
									: 'bg-green-500'}"
							></div>
							<div class="min-w-0 flex-1 space-y-1">
								<div class="flex items-center justify-between gap-2">
									<p class="font-semibold truncate">
										{service.profiles?.name || m.unknown_client()}
									</p>
									<Badge
										variant="outline"
										class="shrink-0 {service.status === 'pending'
											? 'border-blue-500 text-blue-500'
											: 'border-green-500 text-green-500'}"
									>
										{getStatusLabel(service.status)}
									</Badge>
								</div>
								<UrgencyBadge service={service} size="sm" config={pastDueConfig} />
								<p class="text-sm text-muted-foreground truncate">
									{service.pickup_location} &rarr; {service.delivery_location}
								</p>
								{#if service.scheduled_date}
									<p class="flex items-center gap-1 text-sm font-medium text-foreground">
										<CalendarClock class="size-3.5 shrink-0" />
										{formatDate(service.scheduled_date)}
										{#if service.scheduled_time_slot}
											— {service.scheduled_time_slot === 'specific' && service.scheduled_time ? service.scheduled_time : formatTimeSlot(service.scheduled_time_slot)}
										{/if}
									</p>
								{/if}
								{#if service.notes}
									<p class="text-sm text-amber-600 truncate">{service.notes}</p>
								{/if}
								<p class="text-xs text-muted-foreground/60">
									{formatDate(service.created_at)}
								</p>
							</div>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		{/if}
	</div>
</div>
</PullToRefresh>
