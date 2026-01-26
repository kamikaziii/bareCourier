<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import Chart from '$lib/components/charts/Chart.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { TrendingUp, MapPin, Euro, Package } from '@lucide/svelte';
	import type { Totals, StatusData, MonthlyData } from '$lib/services/insights-data';
	import {
		formatCurrency,
		buildServicesChartData,
		buildStatusChartData
	} from '$lib/services/insights-data';

	let {
		loading,
		totals,
		statusData,
		monthlyData
	}: {
		loading: boolean;
		totals: Totals;
		statusData: StatusData;
		monthlyData: MonthlyData[];
	} = $props();

	const servicesChartData = $derived(buildServicesChartData(monthlyData));
	const statusChartData = $derived(buildStatusChartData(statusData));
</script>

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

	<!-- Status Distribution and Services Over Time -->
	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.analytics_status_distribution()}</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if statusData.pending > 0 || statusData.delivered > 0}
					<Chart type="doughnut" data={statusChartData} height="200px" />
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
					<Chart type="bar" data={servicesChartData} height="200px" />
				{:else}
					<p class="py-8 text-center text-muted-foreground">{m.analytics_no_data()}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{/if}
