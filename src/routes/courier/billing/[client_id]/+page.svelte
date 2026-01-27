<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
import { formatDate } from '$lib/utils.js';
	import type { PageData, ActionData } from './$types';
	import type { PricingModel } from '$lib/database.types';
	import { ArrowLeft, Euro, MapPin, Trash2, Plus, FileText, Calculator, AlertTriangle } from '@lucide/svelte';
	import { calculateVat } from '$lib/services/pricing.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// VAT settings from courier profile (via parent layout)
	const vatEnabled = data.profile.vat_enabled ?? false;

	// State for pricing form - svelte-ignore state_referenced_locally for all: intentional initial value capture
	// svelte-ignore state_referenced_locally
	let pricingModel = $state<PricingModel>(data.pricing?.pricing_model || 'per_km');
	// svelte-ignore state_referenced_locally
	let baseFee = $state(data.pricing?.base_fee?.toString() || '0');
	// svelte-ignore state_referenced_locally
	let perKmRate = $state(data.pricing?.per_km_rate?.toString() || '0');

	// State for zones (for zone pricing)
	// svelte-ignore state_referenced_locally
	let zones = $state(
		data.zones.length > 0
			? data.zones.map((z) => ({ min_km: z.min_km, max_km: z.max_km, price: z.price }))
			: [
					{ min_km: 0, max_km: 5, price: 3 },
					{ min_km: 5, max_km: 10, price: 5 },
					{ min_km: 10, max_km: 20, price: 8 },
					{ min_km: 20, max_km: null, price: 12 }
				]
	);

	// State for services list
	let services = $state<any[]>([]);
	let loadingServices = $state(true);
	let totalStats = $state({ services: 0, km: 0, revenue: 0, totalNet: 0, totalVat: 0, totalGross: 0 });
	let recalculating = $state(false);
	let missingPriceCount = $derived(services.filter(s => s.calculated_price === null).length);

	// Date range (default to current month)
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	let startDate = $state(firstOfMonth.toISOString().split('T')[0]);
	let endDate = $state(lastOfMonth.toISOString().split('T')[0]);

	async function loadServices() {
		loadingServices = true;

		const endDatePlusOne = new Date(endDate);
		endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

		const { data: servicesData } = await data.supabase
			.from('services')
			.select('*')
			.eq('client_id', data.client.id)
			.is('deleted_at', null)
			.gte('created_at', new Date(startDate).toISOString())
			.lt('created_at', endDatePlusOne.toISOString())
			.order('created_at', { ascending: false });

		services = servicesData || [];

		// Calculate totals (including VAT in single pass)
		let totalKm = 0;
		let totalRevenue = 0;
		let totalNet = 0;
		let totalVat = 0;
		let totalGross = 0;
		for (const s of services) {
			totalKm += s.distance_km || 0;
			const price = s.calculated_price || 0;
			totalRevenue += price;
			if (vatEnabled) {
				const vb = calculateVat(price, s.vat_rate_snapshot, s.prices_include_vat_snapshot);
				totalNet += vb.net;
				totalVat += vb.vat;
				totalGross += vb.gross;
			}
		}

		totalStats = {
			services: services.length,
			km: Math.round(totalKm * 10) / 10,
			revenue: Math.round(totalRevenue * 100) / 100,
			totalNet: Math.round(totalNet * 100) / 100,
			totalVat: Math.round(totalVat * 100) / 100,
			totalGross: Math.round(totalGross * 100) / 100
		};

		loadingServices = false;
	}

	$effect(() => {
		if (startDate && endDate) {
			loadServices();
		}
	});

	function addZone() {
		const lastZone = zones[zones.length - 1];
		const newMinKm = lastZone?.max_km || 0;
		zones = [...zones, { min_km: newMinKm, max_km: newMinKm + 10, price: 0 }];
	}

	function removeZone(index: number) {
		zones = zones.filter((_, i) => i !== index);
	}

	// Zone validation
	type ZoneError = { index: number; message: string };
	let zoneErrors = $state<ZoneError[]>([]);

	function validateZones(): boolean {
		const errors: ZoneError[] = [];

		// Sort zones by min_km for validation
		const sortedZones = [...zones].sort((a, b) => a.min_km - b.min_km);

		for (let i = 0; i < sortedZones.length; i++) {
			const zone = sortedZones[i];
			const originalIndex = zones.findIndex(
				(z) => z.min_km === zone.min_km && z.max_km === zone.max_km && z.price === zone.price
			);

			// Check for negative values
			if (zone.min_km < 0) {
				errors.push({ index: originalIndex, message: m.billing_zone_error_negative() });
			}

			// Check min < max (if max is set)
			if (zone.max_km !== null && zone.min_km >= zone.max_km) {
				errors.push({ index: originalIndex, message: m.billing_zone_error_min_max() });
			}

			// Check for gaps with next zone
			if (i < sortedZones.length - 1) {
				const nextZone = sortedZones[i + 1];
				if (zone.max_km !== null && zone.max_km < nextZone.min_km) {
					errors.push({ index: originalIndex, message: m.billing_zone_error_gap() });
				}
			}

			// Check for overlaps with next zone
			if (i < sortedZones.length - 1) {
				const nextZone = sortedZones[i + 1];
				if (zone.max_km === null || zone.max_km > nextZone.min_km) {
					errors.push({ index: originalIndex, message: m.billing_zone_error_overlap() });
				}
			}
		}

		// Only one zone can have unlimited max (null)
		const unlimitedZones = zones.filter((z) => z.max_km === null);
		if (unlimitedZones.length > 1) {
			const lastUnlimited = zones.findIndex((z) => z.max_km === null);
			errors.push({ index: lastUnlimited, message: m.billing_zone_error_multiple_unlimited() });
		}

		zoneErrors = errors;
		return errors.length === 0;
	}

	function getZoneError(index: number): string | undefined {
		return zoneErrors.find((e) => e.index === index)?.message;
	}

	function handleZonesSubmit(e: Event) {
		if (!validateZones()) {
			e.preventDefault();
		}
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat(getLocale(), {
			style: 'currency',
			currency: 'EUR'
		}).format(value);
	}

	function handleRecalculate() {
		recalculating = true;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return async ({ result }: { result: any }) => {
			recalculating = false;
			if (result.type === 'success' && result.data?.success) {
				await loadServices();
			}
		};
	}

	function exportClientCSV() {
		const locale = getLocale();

		if (vatEnabled) {
			const headers = [
				m.reports_table_date(),
				m.form_pickup_location(),
				m.form_delivery_location(),
				m.billing_distance(),
				m.billing_net(),
				m.billing_vat(),
				m.billing_gross(),
				m.reports_status()
			];

			const rows = services.map((s) => {
				const vb = calculateVat(s.calculated_price || 0, s.vat_rate_snapshot, s.prices_include_vat_snapshot);
				return [
					new Date(s.created_at).toLocaleDateString(locale),
					s.pickup_location,
					s.delivery_location,
					(s.distance_km || 0).toFixed(1),
					vb.net.toFixed(2),
					vb.vat.toFixed(2),
					vb.gross.toFixed(2),
					s.status === 'delivered' ? m.status_delivered() : m.status_pending()
				];
			});

			rows.push(['', '', '', '', '', '', '', '']);
			rows.push([
				m.billing_total(),
				'',
				'',
				totalStats.km.toFixed(1),
				totalStats.totalNet.toFixed(2),
				totalStats.totalVat.toFixed(2),
				totalStats.totalGross.toFixed(2),
				''
			]);

			const csvContent = [
				headers.join(','),
				...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			].join('\n');

			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `billing_${data.client.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`;
			link.click();
			return;
		}

		const headers = [
			m.reports_table_date(),
			m.form_pickup_location(),
			m.form_delivery_location(),
			m.billing_distance(),
			m.billing_price(),
			m.reports_status()
		];

		const rows = services.map((s) => [
			new Date(s.created_at).toLocaleDateString(locale),
			s.pickup_location,
			s.delivery_location,
			(s.distance_km || 0).toFixed(1),
			(s.calculated_price || 0).toFixed(2),
			s.status === 'delivered' ? m.status_delivered() : m.status_pending()
		]);

		// Add totals
		rows.push(['', '', '', '', '', '']);
		rows.push([
			m.billing_total(),
			'',
			'',
			totalStats.km.toFixed(1),
			totalStats.revenue.toFixed(2),
			''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `billing_${data.client.name.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`;
		link.click();
	}
</script>

<div class="min-w-0 space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref('/courier/billing')}>
			<ArrowLeft class="size-4" />
		</Button>
		<div>
			<h1 class="text-2xl font-bold">{data.client.name}</h1>
			<p class="text-sm text-muted-foreground">{m.billing_client_detail()}</p>
		</div>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 p-3 text-destructive">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-md bg-green-500/10 p-3 text-green-600">
			{m.billing_saved()}
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Pricing Configuration -->
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.billing_pricing_config()}</Card.Title>
				<Card.Description>{m.billing_pricing_config_desc()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/savePricing" use:enhance class="space-y-4">
					<div class="space-y-2">
						<Label for="pricing_model">{m.billing_pricing_model()}</Label>
						<select
							id="pricing_model"
							name="pricing_model"
							bind:value={pricingModel}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
						>
							<option value="per_km">{m.billing_model_per_km()}</option>
							<option value="flat_plus_km">{m.billing_model_flat_plus_km()}</option>
							<option value="zone">{m.billing_model_zone()}</option>
						</select>
					</div>

					{#if pricingModel !== 'zone'}
						<div class="grid gap-4 md:grid-cols-2">
							<div class="space-y-2">
								<Label for="base_fee">{m.billing_base_fee()}</Label>
								<div class="relative">
									<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
									<Input
										id="base_fee"
										name="base_fee"
										type="number"
										step="0.01"
										min="0"
										bind:value={baseFee}
										class="pl-9"
									/>
								</div>
							</div>
							<div class="space-y-2">
								<Label for="per_km_rate">{m.billing_per_km_rate()}</Label>
								<div class="relative">
									<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
									<Input
										id="per_km_rate"
										name="per_km_rate"
										type="number"
										step="0.01"
										min="0"
										bind:value={perKmRate}
										class="pl-9"
									/>
								</div>
							</div>
						</div>
					{:else}
						<input type="hidden" name="base_fee" value="0" />
						<input type="hidden" name="per_km_rate" value="0" />
					{/if}

					<Button type="submit">{m.action_save()}</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- Zone Pricing (only if zone model selected) -->
		{#if pricingModel === 'zone'}
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.billing_zones()}</Card.Title>
					<Card.Description>{m.billing_zones_desc()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST" action="?/saveZones" use:enhance onsubmit={handleZonesSubmit} class="space-y-4">
						<input type="hidden" name="zones" value={JSON.stringify(zones)} />

						{#if zoneErrors.length > 0}
							<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{m.billing_zone_errors()}
							</div>
						{/if}

						<div class="space-y-3">
							{#each zones as zone, index (index)}
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<Input
											type="number"
											step="0.1"
											min="0"
											bind:value={zone.min_km}
											placeholder="Min km"
											class="w-20 {getZoneError(index) ? 'border-destructive' : ''}"
										/>
										<span class="text-muted-foreground">-</span>
										<Input
											type="number"
											step="0.1"
											min="0"
											value={zone.max_km ?? ''}
											onchange={(e) => {
												const value = e.currentTarget.value;
												zone.max_km = value ? parseFloat(value) : null;
											}}
											placeholder={m.billing_zone_max_placeholder()}
											class="w-28 {getZoneError(index) ? 'border-destructive' : ''}"
										/>
										<span class="text-muted-foreground">km =</span>
										<div class="relative flex-1">
											<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
											<Input
												type="number"
												step="0.01"
												min="0"
												bind:value={zone.price}
												class="pl-9"
											/>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onclick={() => removeZone(index)}
											disabled={zones.length <= 1}
										>
											<Trash2 class="size-4" />
										</Button>
									</div>
									{#if getZoneError(index)}
										<p class="text-xs text-destructive">{getZoneError(index)}</p>
									{/if}
								</div>
							{/each}
						</div>

						<div class="flex gap-2">
							<Button type="button" variant="outline" onclick={addZone}>
								<Plus class="mr-2 size-4" />
								{m.billing_add_zone()}
							</Button>
							<Button type="submit">{m.action_save()}</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<Separator />

	<!-- Services History -->
	<div class="space-y-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<h2 class="text-xl font-semibold">{m.billing_services_history()}</h2>
			<div class="flex flex-wrap gap-2">
				{#if missingPriceCount > 0}
					<form method="POST" action="?/recalculateMissing" use:enhance={handleRecalculate}>
						<input type="hidden" name="start_date" value={startDate} />
						<input type="hidden" name="end_date" value={endDate} />
						<Button type="submit" variant="outline" size="sm" disabled={recalculating}>
							<Calculator class="mr-2 size-4" />
							{m.billing_recalculate_missing()} ({missingPriceCount})
						</Button>
					</form>
				{/if}
				<form method="POST" action="?/recalculateAll" use:enhance={handleRecalculate}>
					<input type="hidden" name="start_date" value={startDate} />
					<input type="hidden" name="end_date" value={endDate} />
					<Button type="submit" variant="outline" size="sm" disabled={recalculating || services.length === 0}>
						<Calculator class="mr-2 size-4" />
						{m.billing_recalculate_all()}
					</Button>
				</form>
				<Button variant="outline" size="sm" onclick={exportClientCSV} disabled={services.length === 0}>
					<FileText class="mr-2 size-4" />
					{m.billing_export_csv()}
				</Button>
			</div>
		</div>

		{#if missingPriceCount > 0}
			<div class="rounded-md bg-amber-500/10 p-3 flex items-center gap-2 text-amber-600">
				<AlertTriangle class="size-4" />
				<span class="text-sm">{m.billing_missing_price_warning()}</span>
			</div>
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

		<!-- Summary -->
		{#if vatEnabled}
			<div class="grid gap-4 md:grid-cols-5">
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{totalStats.services}</p>
						<p class="text-sm text-muted-foreground">{m.billing_services()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{totalStats.km} km</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_km()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{formatCurrency(totalStats.totalNet)}</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_net()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{formatCurrency(totalStats.totalVat)}</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_vat()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{formatCurrency(totalStats.totalGross)}</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_gross()}</p>
					</Card.Content>
				</Card.Root>
			</div>
		{:else}
			<div class="grid gap-4 md:grid-cols-3">
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{totalStats.services}</p>
						<p class="text-sm text-muted-foreground">{m.billing_services()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{totalStats.km} km</p>
						<p class="text-sm text-muted-foreground">{m.billing_total_km()}</p>
					</Card.Content>
				</Card.Root>
				<Card.Root>
					<Card.Content class="p-4 text-center">
						<p class="text-2xl font-bold">{formatCurrency(totalStats.revenue)}</p>
						<p class="text-sm text-muted-foreground">{m.billing_estimated_cost()}</p>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}

		<!-- Services Table -->
		<Card.Root>
			<Card.Content class="p-0">
				{#if loadingServices}
					<p class="py-8 text-center text-muted-foreground">{m.loading()}</p>
				{:else if services.length === 0}
					<p class="py-8 text-center text-muted-foreground">{m.billing_no_services()}</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b bg-muted/50">
									<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_date()}</th>
									<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_route()}</th>
									<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_distance()}</th>
									{#if vatEnabled}
										<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_net()}</th>
										<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_vat()}</th>
										<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_gross()}</th>
									{:else}
										<th class="px-4 py-3 text-right text-sm font-medium">{m.billing_price()}</th>
									{/if}
									<th class="px-4 py-3 text-center text-sm font-medium">{m.reports_status()}</th>
								</tr>
							</thead>
							<tbody>
								{#each services as service (service.id)}
									{@const vatBreakdown = vatEnabled ? calculateVat(service.calculated_price || 0, service.vat_rate_snapshot, service.prices_include_vat_snapshot) : null}
									<tr class="border-b">
										<td class="px-4 py-3 text-sm">{formatDate(service.created_at)}</td>
										<td class="px-4 py-3 text-sm text-muted-foreground">
											{service.pickup_location} &rarr; {service.delivery_location}
										</td>
										<td class="px-4 py-3 text-right text-sm">
											{(service.distance_km || 0).toFixed(1)} km
										</td>
										{#if vatEnabled && vatBreakdown}
											<td class="px-4 py-3 text-right text-sm">{formatCurrency(vatBreakdown.net)}</td>
											<td class="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(vatBreakdown.vat)}</td>
											<td class="px-4 py-3 text-right text-sm font-medium">{formatCurrency(vatBreakdown.gross)}</td>
										{:else}
											<td class="px-4 py-3 text-right text-sm font-medium">
												{formatCurrency(service.calculated_price || 0)}
											</td>
										{/if}
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
						</table>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
