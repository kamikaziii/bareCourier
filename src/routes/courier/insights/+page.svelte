<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { debounce } from '$lib/utils.js';
	import { AlertTriangle } from '@lucide/svelte';
	import type { PageData } from './$types';

	// Tab components
	import OverviewTab from '$lib/components/insights/OverviewTab.svelte';
	import ChartsTab from '$lib/components/insights/ChartsTab.svelte';
	import DataTab from '$lib/components/insights/DataTab.svelte';

	// Data services
	import {
		fetchServicesInRange,
		calculateTotals,
		calculateStatusData,
		calculateMonthlyData,
		calculateClientData,
		type ServiceWithProfile,
		type MonthlyData,
		type ClientData,
		type StatusData,
		type Totals
	} from '$lib/services/insights-data';

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

	// State for analytics data
	let loading = $state(true);
	let services = $state<ServiceWithProfile[]>([]);
	let monthlyData = $state<MonthlyData[]>([]);
	let clientData = $state<ClientData[]>([]);
	let statusData = $state<StatusData>({ pending: 0, delivered: 0 });
	let totals = $state<Totals>({ services: 0, km: 0, revenue: 0, avgPerService: 0 });

	// Data truncation warning
	let hasMoreData = $state(false);
	let totalRecordsLoaded = $state(0);

	async function loadData() {
		loading = true;

		const result = await fetchServicesInRange(data.supabase, startDate, endDate);
		services = result.services;
		hasMoreData = result.hasMoreData;
		totalRecordsLoaded = result.totalRecordsLoaded;

		totals = calculateTotals(services);
		statusData = calculateStatusData(services);
		monthlyData = calculateMonthlyData(services);
		clientData = calculateClientData(services, data.clients);

		loading = false;
	}

	// Debounced load to prevent multiple rapid queries when changing date range
	const debouncedLoadData = debounce(loadData, 300);

	$effect(() => {
		if (startDate && endDate) {
			debouncedLoadData();
		}
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

	<!-- Data truncation warning -->
	{#if hasMoreData && !loading}
		<Alert.Root variant="destructive">
			<AlertTriangle class="size-4" />
			<Alert.Title>{m.insights_data_truncated_title()}</Alert.Title>
			<Alert.Description>
				{m.insights_data_truncated_desc({ count: totalRecordsLoaded.toLocaleString() })}
			</Alert.Description>
		</Alert.Root>
	{/if}

	<Tabs.Root value={activeTab} onValueChange={handleTabChange}>
		<Tabs.List class="grid w-full grid-cols-3">
			<Tabs.Trigger value="overview">{m.insights_tab_overview()}</Tabs.Trigger>
			<Tabs.Trigger value="charts">{m.insights_tab_charts()}</Tabs.Trigger>
			<Tabs.Trigger value="data">{m.insights_tab_data()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="overview" class="space-y-6">
			<OverviewTab {loading} {totals} {statusData} {monthlyData} />
		</Tabs.Content>

		<Tabs.Content value="charts" class="space-y-6">
			<ChartsTab {loading} {monthlyData} {clientData} {statusData} />
		</Tabs.Content>

		<Tabs.Content value="data" class="space-y-6">
			<DataTab {loading} {services} clients={data.clients} {startDate} {endDate} />
		</Tabs.Content>
	</Tabs.Root>
</div>
