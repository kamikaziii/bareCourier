<script lang="ts">
	import { goto, invalidateAll, preloadData } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { formatDate, formatCurrency, formatDistance } from '$lib/utils.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { FileText } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { PricingModel } from '$lib/database.types.js';
	import {
		ArrowLeft,
		Edit,
		MoreVertical,
		MapPin,
		Phone,
		User,
		Package,
		CheckCircle,
		Clock,
		UserX,
		UserCheck,
		Euro,
		ChevronLeft,
		ChevronRight
	} from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	let showArchiveDialog = $state(false);
	let loading = $state(false);
	let actionError = $state('');

	// Handle ?tab=billing query param for direct navigation
	const initialTab = $derived($page.url.searchParams.get('tab') || 'info');

	async function handleToggleActive() {
		loading = true;
		actionError = '';

		try {
			const response = await fetch(`?/toggleActive`, { method: 'POST' });

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showArchiveDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to update client status';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	const client = $derived(data.client);
	const services = $derived(data.services);
	const stats = $derived(data.stats);
	const pagination = $derived(data.pagination);
	const pricing = $derived(data.pricing);
	const zones = $derived(data.zones);
	const pricingMode = $derived(data.pricingMode);
	const clientDefaultServiceType = $derived(data.clientDefaultServiceType);

	function getPricingModelLabel(model: PricingModel): string {
		switch (model) {
			case 'per_km':
				return m.billing_model_per_km();
			case 'flat_plus_km':
				return m.billing_model_flat_plus_km();
			case 'zone':
				return m.billing_model_zone();
		}
	}

	// Services history state
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	let historyStartDate = $state(firstOfMonth.toISOString().split('T')[0]);
	let historyEndDate = $state(lastOfMonth.toISOString().split('T')[0]);
	let historyServices = $state<typeof data.services>([]);
	let historyLoading = $state(false);
	let historyStats = $state({ services: 0, km: 0, revenue: 0 });

	async function loadServiceHistory() {
		historyLoading = true;

		const endDatePlusOne = new Date(historyEndDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		const { data: servicesData } = await data.supabase
			.from('services')
			.select('*')
			.eq('client_id', data.client.id)
			.is('deleted_at', null)
			.gte('created_at', new Date(historyStartDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString())
			.order('created_at', { ascending: false });

		historyServices = servicesData || [];

		let totalKm = 0;
		let totalRevenue = 0;
		for (const s of historyServices) {
			totalKm += s.distance_km || 0;
			totalRevenue += s.calculated_price || 0;
		}

		historyStats = {
			services: historyServices.length,
			km: Math.round(totalKm * 10) / 10,
			revenue: Math.round(totalRevenue * 100) / 100
		};

		historyLoading = false;
	}

	function exportClientCSV() {
		const headers = [
			m.reports_table_date(),
			m.form_pickup_location(),
			m.form_delivery_location(),
			m.billing_distance(),
			m.billing_price(),
			m.reports_status()
		];

		const rows = historyServices.map((s) => [
			formatDate(s.created_at),
			s.pickup_location,
			s.delivery_location,
			formatDistance(s.distance_km || 0),
			formatCurrency(s.calculated_price || 0),
			s.status === 'delivered' ? m.status_delivered() : m.status_pending()
		]);

		rows.push(['', '', '', '', '', '']);
		rows.push([
			m.billing_total(),
			'',
			'',
			formatDistance(historyStats.km),
			formatCurrency(historyStats.revenue),
			''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `billing_${data.client.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${historyStartDate}_to_${historyEndDate}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		if (historyStartDate && historyEndDate) {
			loadServiceHistory();
		}
	});

</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" href={localizeHref('/courier/clients')}>
				<ArrowLeft class="size-4" />
			</Button>
			<h1 class="text-2xl font-bold">{client.name}</h1>
			{#if !client.active}
				<Badge variant="secondary" class="bg-muted">{m.clients_inactive()}</Badge>
			{/if}
		</div>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<MoreVertical class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item
					onmouseenter={() => preloadData(localizeHref(`/courier/clients/${client.id}/edit`))}
					onclick={() => goto(localizeHref(`/courier/clients/${client.id}/edit`))}
				>
					<Edit class="mr-2 size-4" />
					{m.action_edit()}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => (showArchiveDialog = true)}>
					{#if client.active}
						<UserX class="mr-2 size-4" />
						{m.clients_deactivate()}
					{:else}
						<UserCheck class="mr-2 size-4" />
						{m.clients_reactivate()}
					{/if}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-3 gap-4">
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<Package class="size-8 text-muted-foreground" />
				<div>
					<p class="text-2xl font-bold">{stats.total}</p>
					<p class="text-sm text-muted-foreground">{m.stats_total()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<Clock class="size-8 text-blue-500" />
				<div>
					<p class="text-2xl font-bold">{stats.pending}</p>
					<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-3 p-4">
				<CheckCircle class="size-8 text-green-500" />
				<div>
					<p class="text-2xl font-bold">{stats.delivered}</p>
					<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<Tabs.Root value={initialTab}>
		<Tabs.List>
			<Tabs.Trigger value="info">{m.tab_info()}</Tabs.Trigger>
			<Tabs.Trigger value="services">{m.tab_services()} ({stats.total})</Tabs.Trigger>
			<Tabs.Trigger value="billing">{m.nav_billing()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="info" class="space-y-4 pt-4">
			<!-- Contact Info -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<User class="size-5" />
						{m.contact_info()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_name()}</p>
						<p class="mt-1">{client.name}</p>
					</div>
					<Separator />
					<div>
						<p class="text-sm font-medium text-muted-foreground">{m.form_phone()}</p>
						{#if client.phone}
							<p class="mt-1 flex items-center gap-2">
								<Phone class="size-4" />
								{client.phone}
							</p>
						{:else}
							<p class="mt-1 text-muted-foreground">{m.clients_no_phone()}</p>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Default Location -->
			{#if client.default_pickup_location}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<MapPin class="size-5" />
							{m.default_location()}
						</Card.Title>
					</Card.Header>
					<Card.Content>
						<p>{client.default_pickup_location}</p>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Account Info -->
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.account_info()}</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_status()}</span>
						<Badge variant={client.active ? 'default' : 'secondary'}>
							{client.active ? m.status_active() : m.clients_inactive()}
						</Badge>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_member_since()}</span>
						<span>{formatDate(client.created_at)}</span>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="services" class="pt-4">
			<div class="space-y-3">
				{#if services.length === 0}
					<Card.Root>
						<Card.Content class="py-8 text-center text-muted-foreground">
							{m.client_no_services()}
						</Card.Content>
					</Card.Root>
				{:else}
					{#each services as service (service.id)}
						<a href={localizeHref(`/courier/services/${service.id}`)} class="block">
							<Card.Root class="transition-colors hover:bg-muted/50">
								<Card.Content class="flex items-start gap-4 p-4">
									<div
										class="mt-1 size-3 shrink-0 rounded-full {service.status === 'pending'
											? 'bg-blue-500'
											: 'bg-green-500'}"
									></div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center justify-between gap-2">
											<p class="text-sm text-muted-foreground truncate">
												{service.pickup_location} &rarr; {service.delivery_location}
											</p>
											<Badge
												variant="outline"
												class={service.status === 'pending'
													? 'border-blue-500 text-blue-500'
													: 'border-green-500 text-green-500'}
											>
												{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
											</Badge>
										</div>
										<p class="mt-1 text-xs text-muted-foreground">
											{formatDate(service.created_at)}
											{#if service.notes}
												&middot; {service.notes}
											{/if}
										</p>
									</div>
								</Card.Content>
							</Card.Root>
						</a>
					{/each}
				{/if}

				{#if pagination.totalPages > 1}
					<div class="flex items-center justify-between pt-4">
						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page <= 1}
							href={localizeHref(`/courier/clients/${client.id}?page=${pagination.page - 1}`)}
						>
							<ChevronLeft class="size-4 mr-1" />
							{m.pagination_previous()}
						</Button>
						<span class="text-sm text-muted-foreground">
							{m.pagination_page_of({ current: pagination.page.toString(), total: pagination.totalPages.toString() })}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={pagination.page >= pagination.totalPages}
							href={localizeHref(`/courier/clients/${client.id}?page=${pagination.page + 1}`)}
						>
							{m.pagination_next()}
							<ChevronRight class="size-4 ml-1" />
						</Button>
					</div>
				{/if}
			</div>
		</Tabs.Content>

		<Tabs.Content value="billing" class="space-y-4 pt-4">
			{#if pricingMode === 'type'}
				<!-- Type-Based Pricing Display -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Euro class="size-5" />
							{m.billing_pricing_config()}
						</Card.Title>
						<Card.Description>{m.billing_type_based_desc()}</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3 rounded-md bg-muted p-4">
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.billing_pricing_mode()}</span>
								<Badge variant="outline">{m.billing_type_based()}</Badge>
							</div>
							<Separator />
							<div class="flex items-center justify-between">
								<div>
									<p class="text-sm text-muted-foreground">{m.billing_default_service_type()}</p>
									{#if clientDefaultServiceType}
										<p class="font-medium">
											{clientDefaultServiceType.name}
											<span class="text-muted-foreground">
												({formatCurrency(clientDefaultServiceType.price)})
											</span>
										</p>
									{:else}
										<p class="text-muted-foreground">{m.billing_no_default_type()}</p>
									{/if}
								</div>
								<Button variant="outline" size="sm" href={localizeHref(`/courier/clients/${client.id}/edit`)}>
									{m.billing_change()}
								</Button>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<!-- Distance-Based Pricing Display (existing code) -->
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Euro class="size-5" />
							{m.billing_pricing_config()}
						</Card.Title>
						<Card.Description>{m.billing_pricing_config_desc()}</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if pricing}
							<div class="mb-4 space-y-2 rounded-md bg-muted p-4">
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.billing_pricing_model()}</span>
									<Badge variant="outline">{getPricingModelLabel(pricing.pricing_model as PricingModel)}</Badge>
								</div>
								{#if pricing.pricing_model !== 'zone'}
									<div class="flex justify-between">
										<span class="text-muted-foreground">{m.billing_base_fee()}</span>
										<span>{formatCurrency(pricing.base_fee)}</span>
									</div>
									<div class="flex justify-between">
										<span class="text-muted-foreground">{m.billing_per_km_rate()}</span>
										<span>{formatCurrency(pricing.per_km_rate)}/km</span>
									</div>
								{:else if zones.length > 0}
									<Separator class="my-2" />
									<p class="text-sm font-medium">{m.billing_zones()}</p>
									{#each zones as zone (zone.id)}
										<div class="flex justify-between text-sm">
											<span class="text-muted-foreground">
												{zone.min_km} - {zone.max_km !== null ? `${zone.max_km} km` : '∞'}
											</span>
											<span>{formatCurrency(zone.price)}</span>
										</div>
									{/each}
								{/if}
							</div>
						{:else}
							<p class="mb-4 text-muted-foreground">{m.billing_not_configured()}</p>
						{/if}
					</Card.Content>
				</Card.Root>

				<!-- Link to edit pricing in billing (only for distance-based) -->
				<Button href={localizeHref(`/courier/billing/${client.id}`)}>
					<Euro class="size-4 mr-2" />
					{m.billing_client_detail()}
				</Button>
			{/if}

			<!-- Services History Section -->
			<Separator class="my-6" />

			<div class="space-y-4">
				<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<h3 class="text-lg font-semibold">{m.billing_services_history()}</h3>
					<Button variant="outline" size="sm" onclick={exportClientCSV} disabled={historyServices.length === 0}>
						<FileText class="mr-2 size-4" />
						{m.billing_export_csv()}
					</Button>
				</div>

				<!-- Date Range -->
				<Card.Root>
					<Card.Content class="pt-6">
						<div class="grid gap-4 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="history_start">{m.reports_start_date()}</Label>
								<Input id="history_start" type="date" bind:value={historyStartDate} />
							</div>
							<div class="space-y-2">
								<Label for="history_end">{m.reports_end_date()}</Label>
								<Input id="history_end" type="date" bind:value={historyEndDate} />
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<!-- Summary Stats -->
				<div class="grid gap-4 md:grid-cols-3">
					<Card.Root>
						<Card.Content class="p-4 text-center">
							<p class="text-2xl font-bold">{historyStats.services}</p>
							<p class="text-sm text-muted-foreground">{m.billing_services()}</p>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content class="p-4 text-center">
							<p class="text-2xl font-bold">{formatDistance(historyStats.km)} km</p>
							<p class="text-sm text-muted-foreground">{m.billing_total_km()}</p>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content class="p-4 text-center">
							<p class="text-2xl font-bold">{formatCurrency(historyStats.revenue)}</p>
							<p class="text-sm text-muted-foreground">{m.billing_estimated_cost()}</p>
						</Card.Content>
					</Card.Root>
				</div>

				<!-- Services Table -->
				<Card.Root>
					<Card.Content class="p-0">
						{#if historyLoading}
							<p class="py-8 text-center text-muted-foreground">{m.loading()}</p>
						{:else if historyServices.length === 0}
							<p class="py-8 text-center text-muted-foreground">{m.billing_no_services()}</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b bg-muted/50">
											<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_date()}</th>
											<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_route()}</th>
											<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_distance()}</th>
											<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_price()}</th>
											<th class="px-4 py-3 text-center text-sm font-medium">{m.reports_status()}</th>
										</tr>
									</thead>
									<tbody>
										{#each historyServices as service (service.id)}
											<tr class="border-b">
												<td class="px-4 py-3 text-sm">{formatDate(service.created_at)}</td>
												<td class="px-4 py-3 text-sm text-muted-foreground truncate max-w-xs">
													{service.pickup_location} → {service.delivery_location}
												</td>
												<td class="px-4 py-3 text-right text-sm">
													{formatDistance(service.distance_km || 0)} km
												</td>
												<td class="px-4 py-3 text-right text-sm font-medium">
													{formatCurrency(service.calculated_price || 0)}
												</td>
												<td class="px-4 py-3 text-center">
													<span
														class="rounded-full px-2 py-0.5 text-xs font-medium {service.status === 'pending'
															? 'bg-blue-500/10 text-blue-500'
															: 'bg-green-500/10 text-green-500'}"
													>
														{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Archive/Reactivate Confirmation Dialog -->
<AlertDialog.Root bind:open={showArchiveDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>
				{client.active ? m.confirm_deactivate_client() : m.confirm_reactivate_client()}
			</AlertDialog.Title>
			<AlertDialog.Description>
				{client.active ? m.confirm_deactivate_client_desc() : m.confirm_reactivate_client_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading} onclick={() => (actionError = '')}>{m.action_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleToggleActive} disabled={loading}>
				{loading ? m.loading() : m.action_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
