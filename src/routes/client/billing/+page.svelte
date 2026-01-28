<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
import { formatDate } from '$lib/utils.js';
	import type { PageData } from './$types';
	import { Euro, MapPin, Package, Receipt, Download } from '@lucide/svelte';
	import SkeletonList from '$lib/components/SkeletonList.svelte';

	let { data }: { data: PageData } = $props();

	// Date range (default to current month)
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

	let startDate = $state(firstOfMonth.toISOString().split('T')[0]);
	let endDate = $state(lastOfMonth.toISOString().split('T')[0]);

	// State for billing data
	let services = $state<any[]>([]);
	let loading = $state(true);
	let totals = $state({ services: 0, km: 0, cost: 0 });

	async function loadBillingData() {
		loading = true;

		const endDatePlusOne = new Date(endDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		// Explicitly filter by client_id for security (in addition to RLS)
		const { data: servicesData } = await data.supabase
			.from('services')
			.select('id, pickup_location, delivery_location, distance_km, calculated_price, status, created_at')
			.eq('client_id', data.profile.id)
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString())
			.order('created_at', { ascending: false });

		services = servicesData || [];

		// Calculate totals
		let totalKm = 0;
		let totalCost = 0;
		for (const s of services) {
			totalKm += s.distance_km || 0;
			totalCost += s.calculated_price || 0;
		}

		totals = {
			services: services.length,
			km: Math.round(totalKm * 10) / 10,
			cost: Math.round(totalCost * 100) / 100
		};

		loading = false;
	}

	$effect(() => {
		if (startDate && endDate) {
			loadBillingData();
		}
	});

	// Pagination
	const PAGE_SIZE = 20;
	let currentPage = $state(1);
	const totalPages = $derived(Math.ceil(services.length / PAGE_SIZE));
	const paginatedServices = $derived(
		services.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	$effect(() => {
		startDate; endDate;
		currentPage = 1;
	});

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: 'EUR'
		}).format(value);
	}

	function getPricingModelLabel(model: string): string {
		switch (model) {
			case 'per_km':
				return m.billing_model_per_km();
			case 'flat_plus_km':
				return m.billing_model_flat_plus_km();
			case 'zone':
				return m.billing_model_zone();
			default:
				return model;
		}
	}

	function exportCSV() {
		if (services.length === 0) return;

		// CSV headers
		const headers = [
			m.reports_table_date(),
			m.reports_table_route(),
			m.billing_distance(),
			m.billing_price(),
			m.reports_status()
		];

		// CSV rows
		const rows = services.map((service) => [
			formatDate(service.created_at),
			`${service.pickup_location} → ${service.delivery_location}`,
			`${(service.distance_km || 0).toFixed(1)} km`,
			formatCurrency(service.calculated_price || 0),
			service.status === 'pending' ? m.status_pending() : m.status_delivered()
		]);

		// Add totals row
		rows.push([
			m.billing_total(),
			'',
			`${totals.km} km`,
			formatCurrency(totals.cost),
			''
		]);

		// Escape and format CSV
		const escapeCell = (cell: string) => {
			if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
				return `"${cell.replace(/"/g, '""')}"`;
			}
			return cell;
		};

		const csvContent = [
			headers.map(escapeCell).join(','),
			...rows.map((row) => row.map(escapeCell).join(','))
		].join('\n');

		// Create and download file
		const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${m.export_filename()}_${startDate}_${endDate}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Receipt class="size-6" />
			<h1 class="text-2xl font-bold">{m.client_billing_title()}</h1>
		</div>
		<Button variant="outline" onclick={exportCSV} disabled={loading || services.length === 0} class="gap-2">
			<Download class="size-4" />
			{m.export_csv()}
		</Button>
	</div>

	<!-- Pricing Info -->
	{#if data.pricing}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.client_your_pricing()}</Card.Title>
				<Card.Description>{m.client_pricing_set_by_courier()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-wrap gap-4">
					<div>
						<p class="text-sm text-muted-foreground">{m.billing_pricing_model()}</p>
						<Badge variant="secondary">{getPricingModelLabel(data.pricing.pricing_model)}</Badge>
					</div>
					{#if data.pricing.pricing_model !== 'zone'}
						<div>
							<p class="text-sm text-muted-foreground">{m.billing_base_fee()}</p>
							<p class="font-medium">{formatCurrency(data.pricing.base_fee)}</p>
						</div>
						<div>
							<p class="text-sm text-muted-foreground">{m.billing_per_km_rate()}</p>
							<p class="font-medium">{formatCurrency(data.pricing.per_km_rate)}/km</p>
						</div>
					{:else if data.zones.length > 0}
						<div>
							<p class="text-sm text-muted-foreground">{m.billing_zones()}</p>
							<div class="mt-1 space-y-1">
								{#each data.zones as zone (zone.id)}
									<p class="text-sm">
										{zone.min_km} - {zone.max_km ?? '∞'} km: {formatCurrency(zone.price)}
									</p>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Card.Content class="py-8 text-center">
				<p class="text-muted-foreground">{m.client_no_pricing_configured()}</p>
			</Card.Content>
		</Card.Root>
	{/if}

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

	<!-- Summary Cards -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card.Root>
			<Card.Content class="p-6">
				<div class="flex items-center gap-4">
					<div class="rounded-full bg-blue-500/10 p-3">
						<Package class="size-6 text-blue-500" />
					</div>
					<div>
						<p class="text-2xl font-bold">{totals.services}</p>
						<p class="text-sm text-muted-foreground">{m.billing_services()}</p>
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
						<p class="text-sm text-muted-foreground">{m.billing_total_km()}</p>
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
						<p class="text-2xl font-bold">{formatCurrency(totals.cost)}</p>
						<p class="text-sm text-muted-foreground">{m.client_estimated_cost()}</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Services List -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.client_services_this_period()}</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			{#if loading}
				<SkeletonList variant="service" count={5} />
			{:else if services.length === 0}
				<p class="py-8 text-center text-muted-foreground">{m.client_no_services()}</p>
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
							{#each paginatedServices as service (service.id)}
								<tr class="border-b">
									<td class="px-4 py-3 text-sm">{formatDate(service.created_at)}</td>
									<td class="px-4 py-3 text-sm text-muted-foreground">
										{service.pickup_location} &rarr; {service.delivery_location}
									</td>
									<td class="px-4 py-3 text-right text-sm">
										{(service.distance_km || 0).toFixed(1)} km
									</td>
									<td class="px-4 py-3 text-right text-sm font-medium">
										{formatCurrency(service.calculated_price || 0)}
									</td>
									<td class="px-4 py-3 text-center">
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
											'pending'
												? 'bg-blue-500/10 text-blue-500'
												: 'bg-green-500/10 text-green-500'}"
										>
											{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t bg-muted/50">
								<td colspan="2" class="px-4 py-3 font-bold">{m.billing_total()}</td>
								<td class="px-4 py-3 text-right font-bold">{totals.km} km</td>
								<td class="px-4 py-3 text-right font-bold">{formatCurrency(totals.cost)}</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				</div>
				{#if totalPages > 1}
					<div class="flex items-center justify-center gap-2 py-4">
						<Button variant="outline" size="sm" disabled={currentPage === 1}
							onclick={() => (currentPage = currentPage - 1)}>Previous</Button>
						<span class="text-muted-foreground text-sm">Page {currentPage} of {totalPages}</span>
						<Button variant="outline" size="sm" disabled={currentPage === totalPages}
							onclick={() => (currentPage = currentPage + 1)}>Next</Button>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>

	<p class="text-center text-sm text-muted-foreground">
		{m.client_billing_note()}
	</p>
</div>
