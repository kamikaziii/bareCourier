<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { Profile } from '$lib/database.types';
	import type { ServiceWithProfile } from '$lib/services/insights-data';
	import { formatDate, getStatusLabel, exportServicesToCSV } from '$lib/services/insights-data';

	let {
		loading,
		services,
		clients,
		startDate,
		endDate
	}: {
		loading: boolean;
		services: ServiceWithProfile[];
		clients: Pick<Profile, 'id' | 'name'>[];
		startDate: string;
		endDate: string;
	} = $props();

	// Local filters
	let clientFilter = $state<string>('all');
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');

	// Filtered services based on filters
	const filteredServices = $derived(
		services.filter((s) => {
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
			return true;
		})
	);

	function handleExport() {
		exportServicesToCSV(filteredServices, startDate, endDate);
	}
</script>

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
				{#each clients as client (client.id)}
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
	<Button onclick={handleExport} disabled={filteredServices.length === 0}>
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
							<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_date()}</th>
							<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_client()}</th>
							<th class="px-4 py-3 text-left text-sm font-medium">{m.reports_table_route()}</th>
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
