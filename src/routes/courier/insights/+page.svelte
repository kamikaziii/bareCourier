<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { ChartData } from 'chart.js';
	import { TrendingUp, MapPin, Euro, Package } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// Tab management
	const validTabs = ['overview', 'charts', 'data'] as const;
	type TabValue = (typeof validTabs)[number];

	const tabParam = $page.url.searchParams.get('tab');
	const initialTab = validTabs.includes(tabParam as TabValue) ? (tabParam as TabValue) : 'overview';
	let activeTab = $state<TabValue>(initialTab);

	function handleTabChange(value: string) {
		activeTab = value as TabValue;
		const url = new URL($page.url);
		url.searchParams.set('tab', value);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}

	// Date range (default to last 6 months)
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
	let startDate = $state(sixMonthsAgo.toISOString().split('T')[0]);
	let endDate = $state(now.toISOString().split('T')[0]);

	// Filters for data tab
	let clientFilter = $state<string>('all');
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');

	// State for analytics data
	let loading = $state(true);
	let services = $state<any[]>([]);
	let monthlyData = $state<{ month: string; services: number; km: number; revenue: number }[]>([]);
	let clientData = $state<{ name: string; services: number; revenue: number }[]>([]);
	let statusData = $state({ pending: 0, delivered: 0 });
	let totals = $state({ services: 0, km: 0, revenue: 0, avgPerService: 0 });

	async function loadData() {
		loading = true;

		const endDatePlusOne = new Date(endDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		const { data: servicesData } = await data.supabase
			.from('services')
			.select('*, profiles!client_id(id, name)')
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString())
			.order('created_at', { ascending: false });

		services = servicesData || [];

		// Calculate totals
		let totalKm = 0;
		let totalRevenue = 0;
		let pending = 0;
		let delivered = 0;

		for (const s of services) {
			totalKm += s.distance_km || 0;
			totalRevenue += s.calculated_price || 0;
			if (s.status === 'pending') pending++;
			else delivered++;
		}

		totals = {
			services: services.length,
			km: Math.round(totalKm * 10) / 10,
			revenue: Math.round(totalRevenue * 100) / 100,
			avgPerService:
				services.length > 0 ? Math.round((totalRevenue / services.length) * 100) / 100 : 0
		};

		statusData = { pending, delivered };

		// Group by month
		const monthMap = new Map<string, { services: number; km: number; revenue: number }>();
		for (const s of services) {
			const date = new Date(s.created_at);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const existing = monthMap.get(monthKey) || { services: 0, km: 0, revenue: 0 };
			existing.services++;
			existing.km += s.distance_km || 0;
			existing.revenue += s.calculated_price || 0;
			monthMap.set(monthKey, existing);
		}

		// Sort by month
		monthlyData = Array.from(monthMap.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([month, d]) => ({
				month: formatMonthLabel(month),
				services: d.services,
				km: Math.round(d.km * 10) / 10,
				revenue: Math.round(d.revenue * 100) / 100
			}));

		// Group by client
		const clientMap = new Map<string, { services: number; revenue: number }>();
		for (const s of services) {
			const existing = clientMap.get(s.client_id) || { services: 0, revenue: 0 };
			existing.services++;
			existing.revenue += s.calculated_price || 0;
			clientMap.set(s.client_id, existing);
		}

		// Map client IDs to names and sort by revenue
		clientData = Array.from(clientMap.entries())
			.map(([clientId, stats]) => {
				const client = data.clients.find((c) => c.id === clientId);
				return {
					name: client?.name || m.unknown_client(),
					services: stats.services,
					revenue: Math.round(stats.revenue * 100) / 100
				};
			})
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 10); // Top 10 clients

		loading = false;
	}

	$effect(() => {
		if (startDate && endDate) {
			loadData();
		}
	});

	function formatMonthLabel(monthKey: string): string {
		const [year, month] = monthKey.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return date.toLocaleDateString(getLocale(), { month: 'short', year: '2-digit' });
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: 'EUR'
		}).format(value);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale());
	}

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}

	// Filtered services for data tab
	const filteredServices = $derived(
		services.filter((s) => {
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
			return true;
		})
	);

	// CSV export
	function exportCSV() {
		const locale = getLocale();
		const headers = [
			m.reports_table_date(),
			m.reports_table_client(),
			m.form_pickup_location(),
			m.form_delivery_location(),
			m.reports_status(),
			m.form_notes(),
			m.status_delivered()
		];
		const rows = filteredServices.map((s) => [
			new Date(s.created_at).toLocaleDateString(locale),
			s.profiles?.name || m.unknown_client(),
			s.pickup_location,
			s.delivery_location,
			getStatusLabel(s.status),
			s.notes || '',
			s.delivered_at ? new Date(s.delivered_at).toLocaleString(locale) : ''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `services_${startDate}_to_${endDate}.csv`;
		link.click();
	}

	// Chart data
	const servicesChartData = $derived<ChartData<'bar'>>({
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_services(),
				data: monthlyData.map((d) => d.services),
				backgroundColor: 'rgba(59, 130, 246, 0.8)',
				borderColor: 'rgb(59, 130, 246)',
				borderWidth: 1
			}
		]
	});

	const revenueChartData = $derived<ChartData<'line'>>({
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_revenue(),
				data: monthlyData.map((d) => d.revenue),
				borderColor: 'rgb(234, 179, 8)',
				backgroundColor: 'rgba(234, 179, 8, 0.1)',
				fill: true,
				tension: 0.3
			}
		]
	});

	const distanceChartData = $derived<ChartData<'line'>>({
		labels: monthlyData.map((d) => d.month),
		datasets: [
			{
				label: m.analytics_distance(),
				data: monthlyData.map((d) => d.km),
				borderColor: 'rgb(34, 197, 94)',
				backgroundColor: 'rgba(34, 197, 94, 0.1)',
				fill: true,
				tension: 0.3
			}
		]
	});

	const clientChartData = $derived<ChartData<'bar'>>({
		labels: clientData.map((d) => d.name),
		datasets: [
			{
				label: m.analytics_revenue(),
				data: clientData.map((d) => d.revenue),
				backgroundColor: 'rgba(168, 85, 247, 0.8)',
				borderColor: 'rgb(168, 85, 247)',
				borderWidth: 1
			}
		]
	});

	const statusChartData = $derived<ChartData<'doughnut'>>({
		labels: [m.status_pending(), m.status_delivered()],
		datasets: [
			{
				data: [statusData.pending, statusData.delivered],
				backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)'],
				borderColor: ['rgb(59, 130, 246)', 'rgb(34, 197, 94)'],
				borderWidth: 1
			}
		]
	});
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">{m.insights_title()}</h1>

	<!-- Date Range (shared across tabs) -->
	<Card.Root>
		<Card.Content class="pt-6">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<Label for="start">{m.reports_start_date()}</Label>
					<Input id="start" type="date" bind:value={startDate} />
				</div>
				<div class="space-y-2">
					<Label for="end">{m.reports_end_date()}</Label>
					<Input id="end" type="date" bind:value={endDate} />
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<Tabs.Root value={activeTab} onValueChange={handleTabChange}>
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="overview">{m.insights_tab_overview()}</Tabs.Trigger>
			<Tabs.Trigger value="charts">{m.insights_tab_charts()}</Tabs.Trigger>
			<Tabs.Trigger value="data">{m.insights_tab_data()}</Tabs.Trigger>
		</Tabs.List>

		<!-- Overview Tab -->
		<Tabs.Content value="overview" class="space-y-6">
			{#if loading}
				<p class="py-8 text-center text-muted-foreground">{m.loading()}</p>
			{:else}
				<!-- Summary Cards -->
				<div class="grid gap-4 md:grid-cols-4">
					<Card.Root>
						<Card.Content class="p-6">
							<div class="flex items-center gap-4">
								<div class="rounded-full bg-blue-500/10 p-3">
									<Package class="size-6 text-blue-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{totals.services}</p>
									<p class="text-sm text-muted-foreground">{m.analytics_total_services()}</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content class="p-6">
							<div class="flex items-center gap-4">
								<div class="rounded-full bg-green-500/10 p-3">
									<MapPin class="size-6 text-green-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{totals.km} km</p>
									<p class="text-sm text-muted-foreground">{m.analytics_total_distance()}</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content class="p-6">
							<div class="flex items-center gap-4">
								<div class="rounded-full bg-yellow-500/10 p-3">
									<Euro class="size-6 text-yellow-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{formatCurrency(totals.revenue)}</p>
									<p class="text-sm text-muted-foreground">{m.analytics_total_revenue()}</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content class="p-6">
							<div class="flex items-center gap-4">
								<div class="rounded-full bg-purple-500/10 p-3">
									<TrendingUp class="size-6 text-purple-500" />
								</div>
								<div>
									<p class="text-2xl font-bold">{formatCurrency(totals.avgPerService)}</p>
									<p class="text-sm text-muted-foreground">{m.analytics_avg_per_service()}</p>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>

				<!-- Status Distribution -->
				<div class="grid gap-6 lg:grid-cols-2">
					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_status_distribution()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if statusData.pending > 0 || statusData.delivered > 0}
								<DoughnutChart data={statusChartData} height="200px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_services_over_time()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if monthlyData.length > 0}
								<BarChart data={servicesChartData} height="200px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>
				</div>
			{/if}
		</Tabs.Content>

		<!-- Charts Tab -->
		<Tabs.Content value="charts" class="space-y-6">
			{#if loading}
				<p class="py-8 text-center text-muted-foreground">{m.loading()}</p>
			{:else}
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Services Over Time -->
					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_services_over_time()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if monthlyData.length > 0}
								<BarChart data={servicesChartData} height="250px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>

					<!-- Revenue Over Time -->
					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_revenue_over_time()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if monthlyData.length > 0}
								<LineChart data={revenueChartData} height="250px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>

					<!-- Distance Over Time -->
					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_distance_over_time()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if monthlyData.length > 0}
								<LineChart data={distanceChartData} height="250px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>

					<!-- Status Distribution -->
					<Card.Root>
						<Card.Header>
							<Card.Title>{m.analytics_status_distribution()}</Card.Title>
						</Card.Header>
						<Card.Content>
							{#if statusData.pending > 0 || statusData.delivered > 0}
								<DoughnutChart data={statusChartData} height="250px" />
							{:else}
								<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
							{/if}
						</Card.Content>
					</Card.Root>
				</div>

				<!-- Revenue by Client -->
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.analytics_revenue_by_client()}</Card.Title>
						<Card.Description>{m.analytics_top_clients()}</Card.Description>
					</Card.Header>
					<Card.Content>
						{#if clientData.length > 0}
							<BarChart
								data={clientChartData}
								height="300px"
								options={{
									indexAxis: 'y',
									plugins: {
										legend: { display: false }
									}
								}}
							/>
						{:else}
							<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>

		<!-- Data Tab -->
		<Tabs.Content value="data" class="space-y-6">
			<div class="flex items-center justify-between">
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div class="space-y-2">
						<Label for="client">{m.reports_client()}</Label>
						<select
							id="client"
							bind:value={clientFilter}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						>
							<option value="all">{m.services_all_clients()}</option>
							{#each data.clients as client (client.id)}
								<option value={client.id}>{client.name}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="status">{m.reports_status()}</Label>
						<select
							id="status"
							bind:value={statusFilter}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						>
							<option value="all">{m.dashboard_all()}</option>
							<option value="pending">{m.status_pending()}</option>
							<option value="delivered">{m.status_delivered()}</option>
						</select>
					</div>
				</div>
				<Button onclick={exportCSV} disabled={filteredServices.length === 0}>
					{m.reports_export_csv()}
				</Button>
			</div>

			<!-- Summary -->
			<div class="grid gap-4 md:grid-cols-3">
				<Card.Root>
					<Card.Content class="p-6 text-center">
						<p class="text-3xl font-bold">{filteredServices.length}</p>
						<p class="text-sm text-muted-foreground">{m.reports_total()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-6 text-center">
						<p class="text-3xl font-bold text-blue-500">
							{filteredServices.filter((s) => s.status === 'pending').length}
						</p>
						<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-6 text-center">
						<p class="text-3xl font-bold text-green-500">
							{filteredServices.filter((s) => s.status === 'delivered').length}
						</p>
						<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
					</Card.Content>
				</Card.Root>
			</div>

			<!-- Services Table -->
			<Card.Root>
				<Card.Content class="p-0">
					{#if loading}
						<p class="py-8 text-center text-muted-foreground">{m.loading()}</p>
					{:else if filteredServices.length === 0}
						<p class="py-8 text-center text-muted-foreground">{m.reports_no_results()}</p>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b bg-muted/50">
										<th class="px-4 py-3 text-left text-sm font-medium"
											>{m.reports_table_date()}</th
										>
										<th class="px-4 py-3 text-left text-sm font-medium"
											>{m.reports_table_client()}</th
										>
										<th class="px-4 py-3 text-left text-sm font-medium"
											>{m.reports_table_route()}</th
										>
										<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_status()}</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredServices as service (service.id)}
										<tr class="border-b">
											<td class="px-4 py-3 text-sm">
												{formatDate(service.created_at)}
											</td>
											<td class="px-4 py-3 text-sm font-medium">
												{service.profiles?.name || m.unknown_client()}
											</td>
											<td class="px-4 py-3 text-sm text-muted-foreground">
												{service.pickup_location} &rarr; {service.delivery_location}
											</td>
											<td class="px-4 py-3">
												<span
													class="rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
													'pending'
														? 'bg-blue-500/10 text-blue-500'
														: 'bg-green-500/10 text-green-500'}"
												>
													{getStatusLabel(service.status)}
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
		</Tabs.Content>
	</Tabs.Root>
</div>
