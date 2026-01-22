<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import LineChart from '$lib/components/charts/LineChart.svelte';
	import DoughnutChart from '$lib/components/charts/DoughnutChart.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { ChartData } from 'chart.js';
	import { TrendingUp, MapPin, Euro, Package } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	// Date range (default to last 6 months)
	const now = new Date();
	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

	let startDate = $state(sixMonthsAgo.toISOString().split('T')[0]);
	let endDate = $state(now.toISOString().split('T')[0]);

	// State for analytics data
	let loading = $state(true);
	let monthlyData = $state<{ month: string; services: number; km: number; revenue: number }[]>([]);
	let clientData = $state<{ name: string; services: number; revenue: number }[]>([]);
	let statusData = $state({ pending: 0, delivered: 0 });
	let totals = $state({ services: 0, km: 0, revenue: 0, avgPerService: 0 });

	async function loadAnalytics() {
		loading = true;

		const endDatePlusOne = new Date(endDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		const { data: services } = await data.supabase
			.from('services')
			.select('id, client_id, status, distance_km, calculated_price, created_at')
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString());

		const allServices = services || [];

		// Calculate totals
		let totalKm = 0;
		let totalRevenue = 0;
		let pending = 0;
		let delivered = 0;

		for (const s of allServices) {
			totalKm += s.distance_km || 0;
			totalRevenue += s.calculated_price || 0;
			if (s.status === 'pending') pending++;
			else delivered++;
		}

		totals = {
			services: allServices.length,
			km: Math.round(totalKm * 10) / 10,
			revenue: Math.round(totalRevenue * 100) / 100,
			avgPerService: allServices.length > 0 ? Math.round((totalRevenue / allServices.length) * 100) / 100 : 0
		};

		statusData = { pending, delivered };

		// Group by month
		const monthMap = new Map<string, { services: number; km: number; revenue: number }>();
		for (const s of allServices) {
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
			.map(([month, data]) => ({
				month: formatMonthLabel(month),
				services: data.services,
				km: Math.round(data.km * 10) / 10,
				revenue: Math.round(data.revenue * 100) / 100
			}));

		// Group by client
		const clientMap = new Map<string, { services: number; revenue: number }>();
		for (const s of allServices) {
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
			loadAnalytics();
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

	// Chart data derived from state
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
	<h1 class="text-2xl font-bold">{m.analytics_title()}</h1>

	<!-- Date Range -->
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

		<!-- Charts Grid -->
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
</div>
