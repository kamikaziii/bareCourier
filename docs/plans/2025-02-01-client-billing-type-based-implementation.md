# Client Billing Type-Based Pricing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the client billing tab and configuration page to support type-based pricing mode with services history, recalculate functionality, and CSV export.

**Architecture:** Conditional UI in billing tab based on `pricing_mode`. Redirect from `/courier/billing/[client_id]` when type-based. Services history loaded client-side with date filtering. Recalculate uses existing `calculateTypedPrice` logic.

**Tech Stack:** SvelteKit, Svelte 5, Supabase, shadcn-svelte, Tailwind CSS v4

---

## Phase 1: Server-Side Data Loading

### Task 1: Load pricing mode and service type info in client detail page

**Files:**
- Modify: `src/routes/courier/clients/[id]/+page.server.ts`

**Step 1: Add imports for ServiceType**

At line 3, update the import:

```typescript
import type { Profile, Service, ClientPricing, PricingZone, ServiceType } from '$lib/database.types';
```

**Step 2: Add queries for pricing mode and service types**

Inside the `Promise.all` block (after line 56), add two more queries:

```typescript
const [servicesResult, totalCountResult, pendingCountResult, deliveredCountResult, pricingResult, zonesResult, courierResult, serviceTypesResult] = await Promise.all([
	// ... existing queries ...
	supabase.from('client_pricing').select('*').eq('client_id', params.id).single(),
	supabase.from('pricing_zones').select('*').eq('client_id', params.id).order('min_km'),
	// NEW: Get courier's pricing mode
	supabase.from('profiles').select('pricing_mode, time_specific_price, out_of_zone_base, out_of_zone_per_km').eq('role', 'courier').single(),
	// NEW: Get service types (for type-based pricing)
	supabase.from('service_types').select('*').eq('active', true).order('sort_order')
]);
```

**Step 3: Extract the new data**

After line 61, add:

```typescript
const { data: courier } = courierResult;
const { data: serviceTypes } = serviceTypesResult;

// Get client's default service type with name/price
let clientDefaultServiceType: { id: string; name: string; price: number } | null = null;
if (client.default_service_type_id && serviceTypes) {
	const found = serviceTypes.find((t: ServiceType) => t.id === client.default_service_type_id);
	if (found) {
		clientDefaultServiceType = { id: found.id, name: found.name, price: Number(found.price) };
	}
}
```

**Step 4: Update the return object**

Update the return statement to include new data:

```typescript
return {
	client: client as Profile,
	services: (services || []) as Service[],
	stats: {
		total: totalCount,
		pending: pendingCount,
		delivered: deliveredCount
	},
	pagination: {
		page,
		totalPages,
		pageSize: PAGE_SIZE,
		totalCount
	},
	pricing: pricing as ClientPricing | null,
	zones: (zones || []) as PricingZone[],
	// NEW
	pricingMode: (courier?.pricing_mode || 'warehouse') as 'warehouse' | 'zone' | 'type',
	clientDefaultServiceType,
	typePricingSettings: courier?.pricing_mode === 'type' ? {
		timeSpecificPrice: courier.time_specific_price ?? 13,
		outOfZoneBase: courier.out_of_zone_base ?? 13,
		outOfZonePerKm: courier.out_of_zone_per_km ?? 0.5
	} : null
};
```

**Step 5: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add src/routes/courier/clients/[id]/+page.server.ts
git commit -m "feat(billing): load pricing mode and service type data in client detail page"
```

---

### Task 2: Add redirect to billing config page when type-based pricing is active

**Files:**
- Modify: `src/routes/courier/billing/[client_id]/+page.server.ts`

**Step 1: Add courier pricing mode check in load function**

After line 25 (after loading urgencyFees), add:

```typescript
// Check if type-based pricing is active - if so, redirect to client detail page
const { data: courier } = await supabase
	.from('profiles')
	.select('pricing_mode')
	.eq('role', 'courier')
	.single();

if (courier?.pricing_mode === 'type') {
	redirect(303, localizeHref(`/courier/clients/${client_id}?tab=billing`));
}
```

**Step 2: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/routes/courier/billing/[client_id]/+page.server.ts
git commit -m "feat(billing): redirect to client detail when type-based pricing is active"
```

---

## Phase 2: Billing Tab UI

### Task 3: Add tab query param handling to client detail page

**Files:**
- Modify: `src/routes/courier/clients/[id]/+page.svelte`

**Step 1: Import page store and add tab state**

At the top of the script section (after line 13), add:

```typescript
import { page } from '$app/stores';
```

After line 32 (after `let actionError = $state('');`), add:

```typescript
// Handle ?tab=billing query param
const initialTab = $derived($page.url.searchParams.get('tab') || 'info');
```

**Step 2: Update Tabs.Root to use controlled value**

Change line 156 from:

```svelte
<Tabs.Root value="info">
```

To:

```svelte
<Tabs.Root value={initialTab}>
```

**Step 3: Verify it works**

Run: `pnpm run dev`
Navigate to `/courier/clients/[id]?tab=billing`
Expected: Billing tab is auto-selected

**Step 4: Commit**

```bash
git add src/routes/courier/clients/[id]/+page.svelte
git commit -m "feat(billing): support ?tab=billing query param for direct navigation"
```

---

### Task 4: Update billing tab with conditional type-based UI

**Files:**
- Modify: `src/routes/courier/clients/[id]/+page.svelte`

**Step 1: Add derived values for new data**

After line 67 (after `const zones = $derived(data.zones);`), add:

```typescript
const pricingMode = $derived(data.pricingMode);
const clientDefaultServiceType = $derived(data.clientDefaultServiceType);
```

**Step 2: Replace the billing tab content (lines 300-351)**

Replace the entire `<Tabs.Content value="billing">` section with:

```svelte
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
</Tabs.Content>
```

**Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: May have missing i18n keys (will add in Task 6)

**Step 4: Commit**

```bash
git add src/routes/courier/clients/[id]/+page.svelte
git commit -m "feat(billing): add conditional type-based pricing display in billing tab"
```

---

### Task 5: Add services history to billing tab

**Files:**
- Modify: `src/routes/courier/clients/[id]/+page.svelte`

**Step 1: Add imports for services history UI**

After line 8 (imports section), add:

```typescript
import { Input } from '$lib/components/ui/input/index.js';
import { Label } from '$lib/components/ui/label/index.js';
import { Calculator, FileText, AlertTriangle } from '@lucide/svelte';
import { formatDistance } from '$lib/utils.js';
```

**Step 2: Add state for services history**

After the tab handling state (around line 35), add:

```typescript
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

	// Calculate totals
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

// Load history when dates change
$effect(() => {
	if (historyStartDate && historyEndDate) {
		loadServiceHistory();
	}
});
```

**Step 3: Add services history section to billing tab**

After the pricing display card (before `</Tabs.Content>` for billing), add:

```svelte
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
```

**Step 4: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors (may have missing i18n keys)

**Step 5: Commit**

```bash
git add src/routes/courier/clients/[id]/+page.svelte
git commit -m "feat(billing): add services history with date filtering and CSV export to billing tab"
```

---

## Phase 3: i18n Keys

### Task 6: Add i18n keys for type-based billing

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/pt-PT.json`

**Step 1: Add English keys**

Add these keys to `messages/en.json`:

```json
"billing_type_based": "Type-based pricing",
"billing_type_based_desc": "Prices are determined by service type. Change the default type in client settings.",
"billing_default_service_type": "Default Service Type",
"billing_no_default_type": "No default type assigned",
"billing_change": "Change",
"billing_services_history": "Services History",
"billing_services": "Services",
"billing_total_km": "Total Distance",
"billing_distance": "Distance",
"billing_price": "Price",
"billing_total": "Total",
"billing_no_services": "No services in this period",
"billing_export_csv": "Export CSV",
"billing_estimated_cost": "Total Revenue"
```

**Step 2: Add Portuguese keys**

Add these keys to `messages/pt-PT.json`:

```json
"billing_type_based": "Preços baseados em tipo",
"billing_type_based_desc": "Os preços são determinados pelo tipo de serviço. Altere o tipo padrão nas definições do cliente.",
"billing_default_service_type": "Tipo de Serviço Padrão",
"billing_no_default_type": "Nenhum tipo padrão atribuído",
"billing_change": "Alterar",
"billing_services_history": "Histórico de Serviços",
"billing_services": "Serviços",
"billing_total_km": "Distância Total",
"billing_distance": "Distância",
"billing_price": "Preço",
"billing_total": "Total",
"billing_no_services": "Sem serviços neste período",
"billing_export_csv": "Exportar CSV",
"billing_estimated_cost": "Receita Total"
```

**Step 3: Verify it compiles**

Run: `pnpm run check`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add messages/en.json messages/pt-PT.json
git commit -m "feat(i18n): add type-based billing translations"
```

---

## Phase 4: Testing

### Task 7: Manual testing checklist

**Test Cases:**

1. **Type-based pricing active:**
   - [ ] Go to `/courier/settings` and set pricing mode to "Type-based"
   - [ ] Navigate to `/courier/clients/[id]` and click Billing tab
   - [ ] Verify "Type-based pricing" badge is shown
   - [ ] Verify client's default service type is displayed (or "No default" message)
   - [ ] Verify "Change" button links to edit page
   - [ ] Verify services history loads with current month

2. **Distance-based pricing active:**
   - [ ] Go to `/courier/settings` and set pricing mode to "Warehouse" or "Zone"
   - [ ] Navigate to `/courier/clients/[id]` and click Billing tab
   - [ ] Verify distance-based pricing info is shown (base fee, per km, zones)
   - [ ] Verify "Configure billing" button links to `/courier/billing/[client_id]`

3. **Redirect from billing config page:**
   - [ ] With type-based pricing active, navigate to `/courier/billing/[client_id]`
   - [ ] Verify redirect to `/courier/clients/[client_id]?tab=billing`

4. **Services history:**
   - [ ] Change date range and verify services reload
   - [ ] Verify stats update correctly
   - [ ] Click "Export CSV" and verify file downloads with correct data

5. **Tab query param:**
   - [ ] Navigate to `/courier/clients/[id]?tab=billing`
   - [ ] Verify billing tab is auto-selected

**Step 1: Run tests**

Run: `pnpm run dev`
Test each case manually

**Step 2: Commit any fixes if needed**

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Load pricing mode and service type data | `+page.server.ts` |
| 2 | Add redirect from billing config page | `billing/[client_id]/+page.server.ts` |
| 3 | Add tab query param handling | `+page.svelte` |
| 4 | Add conditional type-based UI | `+page.svelte` |
| 5 | Add services history | `+page.svelte` |
| 6 | Add i18n keys | `messages/*.json` |
| 7 | Manual testing | - |

**Total: 7 tasks**
