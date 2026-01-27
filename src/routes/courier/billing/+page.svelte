<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { ClientPricing } from '$lib/database.types';
	import { Euro, TrendingUp, MapPin, FileText } from '@lucide/svelte';
	import SkeletonList from '$lib/components/SkeletonList.svelte';

	let { data }: { data: PageData } = $props();

	// State for billing data
	let billingData = $state<Map<string, ClientBilling>>(new Map());
	let loading = $state(true);
	let totalStats = $state({ services: 0, km: 0, revenue: 0 });

	// Date range (default to current month)
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

	let startDate = $state(firstOfMonth.toISOString().split('T')[0]);
	let endDate = $state(lastOfMonth.toISOString().split('T')[0]);

	type ClientBilling = {
		clientId: string;
		clientName: string;
		servicesCount: number;
		deliveredCount: number;
		totalKm: number;
		estimatedCost: number;
		hasPricing: boolean;
	};

	// Create pricing lookup map
	const pricingByClient = $derived(
		new Map(data.pricingConfigs.map((p) => [p.client_id, p]))
	);

	async function loadBillingData() {
		loading = true;

		// Load services for the date range
		const endDatePlusOne = new Date(endDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		const { data: services } = await data.supabase
			.from('services')
			.select('id, client_id, status, distance_km, calculated_price, created_at')
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString());

		// Calculate billing per client
		const billing = new Map<string, ClientBilling>();
		let totals = { services: 0, km: 0, revenue: 0 };

		for (const client of data.clients) {
			const clientServices = (services || []).filter((s) => s.client_id === client.id);
			const pricing = pricingByClient.get(client.id);

			let estimatedCost = 0;
			let totalKm = 0;

			for (const service of clientServices) {
				totalKm += service.distance_km || 0;

				// Use calculated_price if available, otherwise estimate from pricing config
				if (service.calculated_price) {
					estimatedCost += service.calculated_price;
				} else if (pricing) {
					// Simple estimation based on pricing model
					const km = service.distance_km || 0;
					if (pricing.pricing_model === 'per_km' || pricing.pricing_model === 'flat_plus_km') {
						estimatedCost += pricing.base_fee + km * pricing.per_km_rate;
					} else {
						// Zone pricing - just use base fee as estimate
						estimatedCost += pricing.base_fee;
					}
				}
			}

			if (clientServices.length > 0 || client.active) {
				billing.set(client.id, {
					clientId: client.id,
					clientName: client.name,
					servicesCount: clientServices.length,
					deliveredCount: clientServices.filter((s) => s.status === 'delivered').length,
					totalKm: Math.round(totalKm * 10) / 10,
					estimatedCost: Math.round(estimatedCost * 100) / 100,
					hasPricing: !!pricing
				});

				totals.services += clientServices.length;
				totals.km += totalKm;
				totals.revenue += estimatedCost;
			}
		}

		billingData = billing;
		totalStats = {
			services: totals.services,
			km: Math.round(totals.km * 10) / 10,
			revenue: Math.round(totals.revenue * 100) / 100
		};
		loading = false;
	}

	$effect(() => {
		if (startDate && endDate) {
			loadBillingData();
		}
	});

	// Sort clients by revenue (descending)
	const sortedBilling = $derived(
		Array.from(billingData.values()).sort((a, b) => b.estimatedCost - a.estimatedCost)
	);

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: 'EUR'
		}).format(value);
	}

	function exportCSV() {
		const locale = getLocale();
		const headers = [
			m.billing_client(),
			m.billing_services(),
			m.billing_delivered(),
			m.billing_total_km(),
			m.billing_estimated_cost()
		];

		const rows = sortedBilling.map((b) => [
			b.clientName,
			b.servicesCount,
			b.deliveredCount,
			b.totalKm,
			b.estimatedCost.toFixed(2)
		]);

		// Add totals row
		rows.push(['', '', '', '', '']);
		rows.push([
			m.billing_total(),
			totalStats.services,
			'',
			totalStats.km,
			totalStats.revenue.toFixed(2)
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `billing_${startDate}_to_${endDate}.csv`;
		link.click();
	}
</script>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.billing_title()}</h1>
		<Button onclick={exportCSV} disabled={sortedBilling.length === 0}>
			<FileText class="mr-2 size-4" />
			{m.billing_export_csv()}
		</Button>
	</div>

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
						<TrendingUp class="size-6 text-blue-500" />
					</div>
					<div>
						<p class="text-3xl font-bold">{totalStats.services}</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_services()}</p>
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
						<p class="text-3xl font-bold">{totalStats.km} km</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_distance()}</p>
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
						<p class="text-3xl font-bold">{formatCurrency(totalStats.revenue)}</p>
						<p class="text-sm text-muted-foreground">{m.billing_estimated_revenue()}</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Client Billing Table -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{m.billing_by_client()}</Card.Title>
			<Card.Description>{m.billing_by_client_desc()}</Card.Description>
		</Card.Header>
		<Card.Content class="p-0">
			{#if loading}
				<SkeletonList variant="service" count={5} />
			{:else if sortedBilling.length === 0}
				<p class="py-8 text-center text-muted-foreground">{m.billing_no_data()}</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="px-4 py-3 text-left text-sm font-medium">{m.billing_client()}</th>
								<th class="px-4 py-3 text-center text-sm font-medium">{m.billing_services()}</th>
								<th class="px-4 py-3 text-center text-sm font-medium">{m.billing_delivered()}</th>
								<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_total_km()}</th>
								<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_estimated_cost()}</th>
								<th class="px-4 py-3 text-center text-sm font-medium">{m.billing_pricing()}</th>
								<th class="px-4 py-3"></th>
							</tr>
						</thead>
						<tbody>
							{#each sortedBilling as billing (billing.clientId)}
								<tr class="border-b hover:bg-muted/25">
									<td class="px-4 py-3">
										<span class="font-medium">{billing.clientName}</span>
									</td>
									<td class="px-4 py-3 text-center">{billing.servicesCount}</td>
									<td class="px-4 py-3 text-center">
										<span class="text-green-600">{billing.deliveredCount}</span>
									</td>
									<td class="px-4 py-3 text-right">{billing.totalKm} km</td>
									<td class="px-4 py-3 text-right font-medium">
										{formatCurrency(billing.estimatedCost)}
									</td>
									<td class="px-4 py-3 text-center">
										{#if billing.hasPricing}
											<Badge variant="secondary" class="bg-green-500/10 text-green-600">
												{m.billing_configured()}
											</Badge>
										{:else}
											<Badge variant="outline" class="text-muted-foreground">
												{m.billing_not_configured()}
											</Badge>
										{/if}
									</td>
									<td class="px-4 py-3">
										<Button
											variant="ghost"
											size="sm"
											href={localizeHref(`/courier/billing/${billing.clientId}`)}
										>
											{m.action_view()}
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t bg-muted/50">
								<td class="px-4 py-3 font-bold">{m.billing_total()}</td>
								<td class="px-4 py-3 text-center font-bold">{totalStats.services}</td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3 text-right font-bold">{totalStats.km} km</td>
								<td class="px-4 py-3 text-right font-bold">
									{formatCurrency(totalStats.revenue)}
								</td>
								<td colspan="2"></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
