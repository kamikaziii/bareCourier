<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	import AddressInput from '$lib/components/AddressInput.svelte';
	import RouteMap from '$lib/components/RouteMap.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import UrgencyFeeSelect from '$lib/components/UrgencyFeeSelect.svelte';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
	import { type ServiceDistanceResult } from '$lib/services/distance.js';
	import { calculateRouteIfReady as calculateRouteShared } from '$lib/services/route.js';
	import {
		getCourierPricingSettings,
		type CourierPricingSettings
	} from '$lib/services/pricing.js';
	import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import ServiceCard from '$lib/components/ServiceCard.svelte';
	import { CheckSquare, Check, Download, EllipsisVertical, Users } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte.js';
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

	// Batch selection
	const batch = useBatchSelection();
	let batchLoading = $state(false);
	let batchMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	function selectAllVisible() {
		batch.selectAll(filteredServices.filter(s => s.status === 'pending').map(s => s.id));
	}

	async function handleBatchMarkDelivered() {
		if (!batch.hasSelection) return;
		batchLoading = true;
		batchMessage = null;

		const formData = new FormData();
		formData.set('service_ids', JSON.stringify(Array.from(batch.selectedIds)));
		formData.set('status', 'delivered');

		try {
			const response = await fetch('?/batchStatusChange', { method: 'POST', body: formData });
			const result = await response.json();
			if (result.data?.success) {
				batchMessage = { type: 'success', text: m.batch_mark_delivered_success({ count: batch.selectedCount }) };
				batch.reset();
				await loadData();
				setTimeout(() => { batchMessage = null; }, 3000);
			} else {
				batchMessage = { type: 'error', text: result.data?.error || 'Failed' };
			}
		} catch {
			batchMessage = { type: 'error', text: 'An error occurred' };
		}
		batchLoading = false;
	}

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
					const matchesNotes = s.notes?.toLowerCase().includes(query);
					if (!matchesClient && !matchesPickup && !matchesDelivery && !matchesNotes) return false;
				}
				return true;
			}),
			pastDueConfig
		)
	);

	function exportCSV() {
		const escapeCell = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
		const headers = [
			m.reports_table_date(),
			m.billing_client(),
			m.form_pickup_location(),
			m.form_delivery_location(),
			m.billing_distance_km(),
			m.billing_price(),
			m.reports_status()
		];
		const rows = filteredServices.map((s) => [
			formatDate(s.scheduled_date || s.created_at),
			s.profiles?.name || '',
			s.pickup_location,
			s.delivery_location,
			s.distance_km ? `${s.distance_km}` : '',
			s.calculated_price ? `${s.calculated_price}` : '',
			s.status
		]);

		const bom = '\uFEFF';
		const csv = bom + [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `services_${new Date().toISOString().split('T')[0]}.csv`;
		link.click();
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

					<Button type="submit" disabled={formLoading || !selectedClientId || !pickupLocation || !deliveryLocation || (scheduledTimeSlot === 'specific' && !scheduledTime)}>
						{formLoading ? m.services_creating() : m.services_create()}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Filters -->
	<div class="space-y-2">
		<!-- Row 1: Search + kebab menu -->
		<div class="flex gap-2">
			<Input
				type="search"
				placeholder={m.services_search()}
				bind:value={searchQuery}
				class="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="outline" size="icon" {...props} class="relative shrink-0">
							<EllipsisVertical class="size-4" />
							{#if clientFilter !== 'all'}
								<span class="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary"></span>
							{/if}
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={exportCSV} disabled={filteredServices.length === 0}>
						<Download class="size-4 mr-2" />
						Export CSV
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={batch.toggleSelectionMode}>
						<CheckSquare class="size-4 mr-2" />
						{batch.selectionMode ? m.batch_deselect_all() : m.batch_selection_mode()}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Sub>
						<DropdownMenu.SubTrigger>
							<Users class="size-4 mr-2" />
							{clientFilter !== 'all' ? clients.find(c => c.id === clientFilter)?.name : m.services_all_clients()}
						</DropdownMenu.SubTrigger>
						<DropdownMenu.SubContent>
							<DropdownMenu.RadioGroup bind:value={clientFilter}>
								<DropdownMenu.RadioItem value="all">{m.services_all_clients()}</DropdownMenu.RadioItem>
								{#each clients as client (client.id)}
									<DropdownMenu.RadioItem value={client.id}>{client.name}</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
						</DropdownMenu.SubContent>
					</DropdownMenu.Sub>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>

		<!-- Row 2: Status filter chips -->
		<div class="flex gap-1.5">
			<Button
				variant={statusFilter === 'all' ? 'default' : 'outline'}
				size="sm"
				class="rounded-full"
				onclick={() => (statusFilter = 'all')}
			>
				{m.services_all_status()}
			</Button>
			<Button
				variant={statusFilter === 'pending' ? 'default' : 'outline'}
				size="sm"
				class="rounded-full"
				onclick={() => (statusFilter = 'pending')}
			>
				{m.status_pending()}
			</Button>
			<Button
				variant={statusFilter === 'delivered' ? 'default' : 'outline'}
				size="sm"
				class="rounded-full"
				onclick={() => (statusFilter = 'delivered')}
			>
				{m.status_delivered()}
			</Button>
		</div>
	</div>

	<!-- Selection Toolbar -->
	{#if batch.selectionMode}
		<div class="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/50 p-2">
			<Button variant="outline" size="sm" onclick={selectAllVisible}>
				{m.batch_select_all()}
			</Button>
			{#if batch.hasSelection}
				<span class="text-sm text-muted-foreground">
					{m.batch_selected_count({ count: batch.selectedCount })}
				</span>
				<Button size="sm" onclick={handleBatchMarkDelivered} disabled={batchLoading}>
					<Check class="size-4 mr-1" />
					{batchLoading ? m.saving() : m.batch_mark_delivered()}
				</Button>
				<Button size="sm" variant="ghost" onclick={batch.deselectAll}>
					{m.batch_deselect_all()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Batch feedback -->
	{#if batchMessage}
		<div class="rounded-md p-3 {batchMessage.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}">
			{batchMessage.text}
		</div>
	{/if}

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
				<ServiceCard
					{service}
					showClientName={true}
					selectable={batch.selectionMode}
					selected={batch.has(service.id)}
					onToggle={() => batch.toggle(service.id)}
					onClick={() => { goto(localizeHref(`/courier/services/${service.id}`)); }}
				>
					{#snippet urgencyBadge()}
						<UrgencyBadge service={service} size="sm" config={pastDueConfig} />
					{/snippet}
				</ServiceCard>
			{/each}
		{/if}
	</div>
</div>
</PullToRefresh>
