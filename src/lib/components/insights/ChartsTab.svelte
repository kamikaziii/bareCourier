<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import Chart from '$lib/components/charts/Chart.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { StatusData, MonthlyData, ClientData } from '$lib/services/insights-data';
	import {
		buildServicesChartData,
		buildRevenueChartData,
		buildDistanceChartData,
		buildClientChartData,
		buildStatusChartData
	} from '$lib/services/insights-data';

	let {
		loading,
		monthlyData,
		clientData,
		statusData
	}: {
		loading: boolean;
		monthlyData: MonthlyData[];
		clientData: ClientData[];
		statusData: StatusData;
	} = $props();

	const servicesChartData = $derived(buildServicesChartData(monthlyData));
	const revenueChartData = $derived(buildRevenueChartData(monthlyData));
	const distanceChartData = $derived(buildDistanceChartData(monthlyData));
	const clientChartData = $derived(buildClientChartData(clientData));
	const statusChartData = $derived(buildStatusChartData(statusData));
</script>

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
					<Chart type="bar" data={servicesChartData} height="250px" />
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
					<Chart type="line" data={revenueChartData} height="250px" />
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
					<Chart type="line" data={distanceChartData} height="250px" />
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
					<Chart type="doughnut" data={statusChartData} height="250px" />
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
				<Chart
					type="bar"
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
