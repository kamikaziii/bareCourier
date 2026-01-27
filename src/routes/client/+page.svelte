<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import type { PageData } from './$types';
	import type { Service } from '$lib/database.types.js';
	import { Search, X, Filter, CalendarClock } from '@lucide/svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import ServiceCard from '$lib/components/ServiceCard.svelte';

	let { data }: { data: PageData } = $props();

	let services = $state<Service[]>([]);
	let loading = $state(true);
	let actionLoading = $state(false);
	let actionError = $state('');

	// Dialog state for suggestion response
	let showSuggestionDialog = $state(false);
	let selectedService = $state<Service | null>(null);

	// Cancel dialog state
	let showCancelDialog = $state(false);
	let serviceToCancel = $state<Service | null>(null);

	// Filter state
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');
	let dateFilter = $state<'today' | 'tomorrow' | 'all'>('all');
	let searchQuery = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let showFilters = $state(false);
	let sortBy = $state<'newest' | 'oldest' | 'pending-first' | 'delivered-first'>('newest');

	async function loadServices() {
		loading = true;
		const { data: result } = await data.supabase
			.from('services')
			.select('*')
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		services = (result || []) as Service[];
		loading = false;
	}

	$effect(() => {
		loadServices();
	});

	// Filtered services based on all filters
	const filteredServices = $derived.by(() => {
		let result = services;

		// Status filter
		if (statusFilter !== 'all') {
			result = result.filter((s) => s.status === statusFilter);
		}

		// Search filter (pickup or delivery location)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			result = result.filter(
				(s) =>
					s.pickup_location.toLowerCase().includes(query) ||
					s.delivery_location.toLowerCase().includes(query) ||
					s.notes?.toLowerCase().includes(query)
			);
		}

		// Quick date filter
		if (dateFilter !== 'all') {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const targetDate = dateFilter === 'tomorrow' ? new Date(today.getTime() + 86400000) : today;
			const targetStr = targetDate.toISOString().split('T')[0];
			result = result.filter((s) => {
				const schedDate = s.scheduled_date || s.requested_date;
				return schedDate === targetStr;
			});
		}

		// Date range filter
		if (dateFrom) {
			const fromDate = new Date(dateFrom);
			fromDate.setHours(0, 0, 0, 0);
			result = result.filter((s) => new Date(s.created_at) >= fromDate);
		}
		if (dateTo) {
			const toDate = new Date(dateTo);
			toDate.setHours(23, 59, 59, 999);
			result = result.filter((s) => new Date(s.created_at) <= toDate);
		}

		return result;
	});

	function sortServices(list: typeof filteredServices) {
		return [...list].sort((a, b) => {
			switch (sortBy) {
				case 'newest':
					return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
				case 'oldest':
					return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
				case 'pending-first':
					return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1);
				case 'delivered-first':
					return (a.status === 'delivered' ? 0 : 1) - (b.status === 'delivered' ? 0 : 1);
				default:
					return 0;
			}
		});
	}

	const sortedServices = $derived(sortServices(filteredServices));

	// Check if any filter is active
	const hasActiveFilters = $derived(
		statusFilter !== 'all' || dateFilter !== 'all' || searchQuery.trim() !== '' || dateFrom !== '' || dateTo !== ''
	);

	// Filter services by type
	const suggestedServices = $derived(services.filter((s) => s.request_status === 'suggested'));
	const pendingCount = $derived(filteredServices.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(filteredServices.filter((s) => s.status === 'delivered').length);


	function openSuggestionDialog(service: Service) {
		selectedService = service;
		actionError = '';
		showSuggestionDialog = true;
	}

	function openCancelDialog(service: Service, e: Event) {
		e.preventDefault();
		e.stopPropagation();
		serviceToCancel = service;
		showCancelDialog = true;
	}

	function clearFilters() {
		statusFilter = 'all';
		dateFilter = 'all';
		searchQuery = '';
		dateFrom = '';
		dateTo = '';
	}

	async function handleCancelRequest() {
		if (!serviceToCancel) return;
		actionLoading = true;

		const formData = new FormData();
		formData.set('service_id', serviceToCancel.id);

		try {
			const response = await fetch('?/cancelRequest', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await loadServices();
					showCancelDialog = false;
					serviceToCancel = null;
				}
			}
		} catch {
			// Silent fail, user will see the service still there
		}
		actionLoading = false;
	}

	async function handleAcceptSuggestion() {
		if (!selectedService) return;
		actionLoading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);

		try {
			const response = await fetch('?/acceptSuggestion', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await loadServices();
					showSuggestionDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to accept suggestion';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		actionLoading = false;
	}

	async function handleDeclineSuggestion() {
		if (!selectedService) return;
		actionLoading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);

		try {
			const response = await fetch('?/declineSuggestion', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await loadServices();
					showSuggestionDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to decline suggestion';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		actionLoading = false;
	}
</script>

<PullToRefresh>
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.client_my_services()}</h1>
		<Button onclick={() => goto(localizeHref('/client/new'))}>{m.client_new_request()}</Button>
	</div>

	<!-- Suggested Services Alert -->
	{#if suggestedServices.length > 0}
		<Card.Root class="border-orange-500 bg-orange-500/5">
			<Card.Header class="pb-3">
				<Card.Title class="text-orange-600 flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" x2="12" y1="8" y2="12" />
						<line x1="12" x2="12.01" y1="16" y2="16" />
					</svg>
					{m.client_suggestions_pending()}
				</Card.Title>
				<Card.Description>
					{m.client_suggestions_description()}
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each suggestedServices as service (service.id)}
					<div class="flex items-center justify-between gap-4 p-3 rounded-lg bg-background border">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium truncate">
								{service.pickup_location} → {service.delivery_location}
							</p>
							<p class="text-sm text-muted-foreground">
								{m.requests_suggested_date()}: {formatDate(service.suggested_date || '')}
								{#if service.suggested_time_slot}
									- {formatTimeSlot(service.suggested_time_slot)}
								{/if}
							</p>
						</div>
						<Button size="sm" onclick={() => openSuggestionDialog(service)}>
							{m.action_respond()}
						</Button>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Content class="flex items-center gap-4 p-6">
				<div class="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
					<div class="size-4 rounded-full bg-blue-500"></div>
				</div>
				<div>
					<p class="text-2xl font-bold">{pendingCount}</p>
					<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-4 p-6">
				<div class="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
					<div class="size-4 rounded-full bg-green-500"></div>
				</div>
				<div>
					<p class="text-2xl font-bold">{deliveredCount}</p>
					<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Filters -->
	<div class="space-y-4">
		<!-- Quick filters row -->
		<div class="flex flex-wrap items-center gap-2">
			<!-- Date filter buttons -->
			<Button
				variant={dateFilter === 'today' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (dateFilter = dateFilter === 'today' ? 'all' : 'today')}
			>
				{m.dashboard_today()}
			</Button>
			<Button
				variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (dateFilter = dateFilter === 'tomorrow' ? 'all' : 'tomorrow')}
			>
				{m.dashboard_tomorrow()}
			</Button>

			<div class="w-px h-6 bg-border"></div>

			<!-- Status filter buttons -->
			<Button
				variant={statusFilter === 'all' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (statusFilter = 'all')}
			>
				{m.filter_all()}
			</Button>
			<Button
				variant={statusFilter === 'pending' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (statusFilter = 'pending')}
			>
				{m.status_pending()}
			</Button>
			<Button
				variant={statusFilter === 'delivered' ? 'default' : 'outline'}
				size="sm"
				onclick={() => (statusFilter = 'delivered')}
			>
				{m.status_delivered()}
			</Button>

			<div class="flex-1"></div>

			<!-- Sort dropdown -->
			<select
				class="border-input bg-background rounded-md border px-3 py-2 text-sm"
				bind:value={sortBy}
			>
				<option value="newest">Newest first</option>
				<option value="oldest">Oldest first</option>
				<option value="pending-first">Pending first</option>
				<option value="delivered-first">Delivered first</option>
			</select>

			<!-- Toggle advanced filters -->
			<Button
				variant="outline"
				size="sm"
				class="gap-2"
				onclick={() => (showFilters = !showFilters)}
			>
				<Filter class="size-4" />
				<span class="hidden sm:inline">{m.services_search()}</span>
			</Button>

			{#if hasActiveFilters}
				<Button variant="ghost" size="sm" onclick={clearFilters} class="gap-1">
					<X class="size-4" />
					{m.filter_clear()}
				</Button>
			{/if}
		</div>

		<!-- Advanced filters (collapsible) -->
		{#if showFilters}
			<Card.Root>
				<Card.Content class="pt-6">
					<div class="grid gap-4 md:grid-cols-3">
						<!-- Search -->
						<div class="md:col-span-1">
							<Label for="search">{m.services_search()}</Label>
							<div class="relative">
								<Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
								<Input
									id="search"
									type="text"
									placeholder={m.filter_search_location()}
									bind:value={searchQuery}
									class="pl-10"
								/>
							</div>
						</div>
						<!-- Date From -->
						<div>
							<Label for="dateFrom">{m.filter_date_from()}</Label>
							<Input id="dateFrom" type="date" bind:value={dateFrom} />
						</div>
						<!-- Date To -->
						<div>
							<Label for="dateTo">{m.filter_date_to()}</Label>
							<Input id="dateTo" type="date" bind:value={dateTo} />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Result count -->
		{#if hasActiveFilters && !loading}
			<p class="text-sm text-muted-foreground">
				{m.filter_showing({ count: filteredServices.length, total: services.length })}
			</p>
		{/if}
	</div>

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<SkeletonList variant="service" count={5} />
		{:else if sortedServices.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center">
					{#if hasActiveFilters}
						<p class="text-muted-foreground mb-4">{m.services_no_results()}</p>
						<Button variant="outline" onclick={clearFilters}>{m.filter_clear()}</Button>
					{:else}
						<p class="text-muted-foreground mb-4">{m.client_no_services()}</p>
						<Button onclick={() => goto(localizeHref('/client/new'))}>{m.client_first_request()}</Button>
					{/if}
				</Card.Content>
			</Card.Root>
		{:else}
			{#each sortedServices as service (service.id)}
				<ServiceCard
					{service}
					showClientName={false}
					showRequestStatus={true}
					showDeliveredAt={true}
					onClick={() => goto(localizeHref(`/client/services/${service.id}`))}
				>
					{#snippet extraContent()}
						{#if service.request_status === 'pending' && service.status === 'pending'}
							<Button
								variant="ghost"
								size="sm"
								class="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
								onclick={(e: Event) => openCancelDialog(service, e)}
							>
								{m.action_cancel_request()}
							</Button>
						{/if}
					{/snippet}
				</ServiceCard>
			{/each}
		{/if}
	</div>
</div>
</PullToRefresh>

<!-- Cancel Request Dialog -->
<AlertDialog.Root bind:open={showCancelDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.confirm_cancel_request()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.confirm_cancel_request_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if serviceToCancel}
			<div class="rounded-lg bg-muted p-4 space-y-2">
				<p class="text-sm">
					<span class="font-medium">{m.form_pickup_location()}:</span>
					{serviceToCancel.pickup_location}
				</p>
				<p class="text-sm">
					<span class="font-medium">{m.form_delivery_location()}:</span>
					{serviceToCancel.delivery_location}
				</p>
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={actionLoading}>{m.action_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleCancelRequest}
				disabled={actionLoading}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				{actionLoading ? m.saving() : m.action_cancel_request()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Suggestion Response Dialog -->
<Dialog.Root bind:open={showSuggestionDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.client_respond_to_suggestion()}</Dialog.Title>
			<Dialog.Description>
				{m.client_suggestion_response_desc()}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedService}
			<div class="space-y-4">
				<div class="rounded-lg bg-muted p-4 space-y-2">
					<p class="text-sm">
						<span class="font-medium">{m.form_pickup_location()}:</span>
						{selectedService.pickup_location}
					</p>
					<p class="text-sm">
						<span class="font-medium">{m.form_delivery_location()}:</span>
						{selectedService.delivery_location}
					</p>
				</div>

				{#if selectedService.requested_date || selectedService.requested_time_slot}
					<div class="text-sm">
						<p class="text-muted-foreground">{m.client_your_request()}:</p>
						<p>
							{formatDate(selectedService.requested_date || '')}
							{#if selectedService.requested_time_slot}
								- {formatTimeSlot(selectedService.requested_time_slot)}
							{/if}
						</p>
					</div>
				{/if}

				<div class="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
					<p class="text-sm font-medium text-orange-600">{m.client_courier_suggests()}:</p>
					<p class="text-lg font-semibold">
						{formatDate(selectedService.suggested_date || '')}
						{#if selectedService.suggested_time_slot}
							- {formatTimeSlot(selectedService.suggested_time_slot)}
						{/if}
					</p>
				</div>
			</div>
		{/if}

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer class="flex-col sm:flex-row gap-2">
			<Button variant="outline" onclick={() => (showSuggestionDialog = false)} disabled={actionLoading}>
				{m.action_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDeclineSuggestion} disabled={actionLoading}>
				{actionLoading ? m.saving() : m.action_decline()}
			</Button>
			<Button onclick={handleAcceptSuggestion} disabled={actionLoading}>
				{actionLoading ? m.saving() : m.action_accept()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
