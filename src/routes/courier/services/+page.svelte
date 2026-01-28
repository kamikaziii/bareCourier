<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
	import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import ServiceCard from '$lib/components/ServiceCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { CheckSquare, Check, Download, EllipsisVertical, Package, Users } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte.js';
	import type { PageData } from './$types';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import { usePagination } from '$lib/composables/use-pagination.svelte.js';
	import PaginationControls from '$lib/components/PaginationControls.svelte';

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

	// Warning from create form (via URL search params)
	let formWarning = $state('');

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

	async function loadData() {
		loading = true;

		const [servicesResult, clientsResult] = await Promise.all([
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
				.order('name')
		]);

		services = servicesResult.data || [];
		clients = clientsResult.data || [];
		loading = false;

	}

	$effect(() => {
		loadData();
	});

	$effect(() => {
		const warning = $page.url.searchParams.get('warning');
		if (warning) {
			formWarning = warning;
			const url = new URL($page.url);
			url.searchParams.delete('warning');
			replaceState(url, {});
		}
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

	// Pagination
	const pagination = usePagination(() => filteredServices);

	$effect(() => {
		statusFilter; clientFilter; searchQuery;
		pagination.reset();
	});

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
		<Button href={localizeHref('/courier/services/new')}>
			{m.services_new()}
		</Button>
	</div>

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
			<EmptyState
				icon={Package}
				title={m.services_no_results()}
				description={m.empty_courier_services()}
				actionLabel={m.services_new()}
				actionHref={localizeHref('/courier/services/new')}
			/>
		{:else}
			<p class="text-sm text-muted-foreground">
				{m.services_showing({ count: filteredServices.length })}
			</p>
			{#each pagination.paginatedItems as service (service.id)}
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
			<PaginationControls
				currentPage={pagination.currentPage}
				totalPages={pagination.totalPages}
				onPrev={pagination.prev}
				onNext={pagination.next}
			/>
		{/if}
	</div>
</div>
</PullToRefresh>
