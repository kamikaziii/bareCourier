<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let services = $state<any[]>([]);
	let clients = $state<any[]>([]);
	let loading = $state(true);

	// Filters
	let clientFilter = $state<string>('all');
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');

	// Set default date range to current month
	const now = new Date();
	const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

	// Initialize dates directly instead of using $effect
	const initialStartDate = firstOfMonth.toISOString().split('T')[0];
	const initialEndDate = lastOfMonth.toISOString().split('T')[0];
	let startDate = $state(initialStartDate);
	let endDate = $state(initialEndDate);

	async function loadData() {
		loading = true;

		let query = data.supabase
			.from('services')
			.select('*, profiles!client_id(id, name)')
			.order('created_at', { ascending: false });

		if (startDate) {
			query = query.gte('created_at', new Date(startDate).toISOString());
		}
		if (endDate) {
			const end = new Date(endDate);
			end.setDate(end.getDate() + 1);
			query = query.lt('created_at', end.toISOString());
		}

		const [servicesResult, clientsResult] = await Promise.all([
			query,
			data.supabase
				.from('profiles')
				.select('id, name')
				.eq('role', 'client')
				.order('name')
		]);

		services = servicesResult.data || [];
		clients = clientsResult.data || [];
		loading = false;
	}

	$effect(() => {
		if (startDate && endDate) {
			loadData();
		}
	});

	const filteredServices = $derived(
		services.filter((s) => {
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
			return true;
		})
	);

	const summary = $derived({
		total: filteredServices.length,
		pending: filteredServices.filter((s) => s.status === 'pending').length,
		delivered: filteredServices.filter((s) => s.status === 'delivered').length
	});

	function exportCSV() {
		const headers = ['Date', 'Client', 'Pickup', 'Delivery', 'Status', 'Notes', 'Delivered At'];
		const rows = filteredServices.map((s) => [
			new Date(s.created_at).toLocaleDateString(),
			s.profiles?.name || 'Unknown',
			s.pickup_location,
			s.delivery_location,
			s.status,
			s.notes || '',
			s.delivered_at ? new Date(s.delivered_at).toLocaleString() : ''
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
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Reports</h1>
		<Button onclick={exportCSV} disabled={filteredServices.length === 0}>
			Export CSV
		</Button>
	</div>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="pt-6">
			<div class="grid gap-4 md:grid-cols-4">
				<div class="space-y-2">
					<Label for="start">Start Date</Label>
					<Input
						id="start"
						type="date"
						bind:value={startDate}
					/>
				</div>
				<div class="space-y-2">
					<Label for="end">End Date</Label>
					<Input
						id="end"
						type="date"
						bind:value={endDate}
					/>
				</div>
				<div class="space-y-2">
					<Label for="client">Client</Label>
					<select
						id="client"
						bind:value={clientFilter}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						<option value="all">All Clients</option>
						{#each clients as client}
							<option value={client.id}>{client.name}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-2">
					<Label for="status">Status</Label>
					<select
						id="status"
						bind:value={statusFilter}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						<option value="all">All</option>
						<option value="pending">Pending</option>
						<option value="delivered">Delivered</option>
					</select>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Summary -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card.Root>
			<Card.Content class="p-6 text-center">
				<p class="text-3xl font-bold">{summary.total}</p>
				<p class="text-sm text-muted-foreground">Total Services</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="p-6 text-center">
				<p class="text-3xl font-bold text-blue-500">{summary.pending}</p>
				<p class="text-sm text-muted-foreground">Pending</p>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="p-6 text-center">
				<p class="text-3xl font-bold text-green-500">{summary.delivered}</p>
				<p class="text-sm text-muted-foreground">Delivered</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Services Table -->
	<Card.Root>
		<Card.Content class="p-0">
			{#if loading}
				<p class="text-center text-muted-foreground py-8">Loading...</p>
			{:else if filteredServices.length === 0}
				<p class="text-center text-muted-foreground py-8">No services found for this period</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="px-4 py-3 text-left text-sm font-medium">Date</th>
								<th class="px-4 py-3 text-left text-sm font-medium">Client</th>
								<th class="px-4 py-3 text-left text-sm font-medium">Route</th>
								<th class="px-4 py-3 text-left text-sm font-medium">Status</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredServices as service}
								<tr class="border-b">
									<td class="px-4 py-3 text-sm">
										{new Date(service.created_at).toLocaleDateString()}
									</td>
									<td class="px-4 py-3 text-sm font-medium">
										{service.profiles?.name || 'Unknown'}
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
											{service.status}
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
