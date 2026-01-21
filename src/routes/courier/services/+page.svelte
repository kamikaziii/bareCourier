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
	let statusFilter = $state<'all' | 'pending' | 'delivered'>('all');
	let clientFilter = $state<string>('all');
	let searchQuery = $state('');

	// New service form
	let showForm = $state(false);
	let selectedClientId = $state('');
	let pickupLocation = $state('');
	let deliveryLocation = $state('');
	let notes = $state('');
	let formLoading = $state(false);
	let formError = $state('');

	async function loadData() {
		loading = true;

		const [servicesResult, clientsResult] = await Promise.all([
			data.supabase
				.from('services')
				.select('*, profiles!client_id(id, name, default_pickup_location)')
				.order('created_at', { ascending: false }),
			data.supabase
				.from('profiles')
				.select('id, name, default_pickup_location')
				.eq('role', 'client')
				.eq('active', true)
				.order('name')
		]);

		services = servicesResult.data || [];
		clients = clientsResult.data || [];
		loading = false;
	}

	async function toggleStatus(service: any) {
		const newStatus = service.status === 'pending' ? 'delivered' : 'pending';
		const updates: any = { status: newStatus };

		if (newStatus === 'delivered') {
			updates.delivered_at = new Date().toISOString();
		} else {
			updates.delivered_at = null;
		}

		await data.supabase.from('services').update(updates).eq('id', service.id);
		await loadData();
	}

	async function handleCreateService(e: Event) {
		e.preventDefault();
		formLoading = true;
		formError = '';

		const { error: insertError } = await data.supabase.from('services').insert({
			client_id: selectedClientId,
			pickup_location: pickupLocation,
			delivery_location: deliveryLocation,
			notes: notes || null
		});

		if (insertError) {
			formError = insertError.message;
			formLoading = false;
			return;
		}

		// Reset form
		showForm = false;
		selectedClientId = '';
		pickupLocation = '';
		deliveryLocation = '';
		notes = '';
		formLoading = false;

		await loadData();
	}

	function handleClientSelect() {
		const client = clients.find((c) => c.id === selectedClientId);
		if (client?.default_pickup_location) {
			pickupLocation = client.default_pickup_location;
		}
	}

	$effect(() => {
		loadData();
	});

	const filteredServices = $derived(
		services.filter((s) => {
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesClient = s.profiles?.name?.toLowerCase().includes(query);
				const matchesPickup = s.pickup_location?.toLowerCase().includes(query);
				const matchesDelivery = s.delivery_location?.toLowerCase().includes(query);
				if (!matchesClient && !matchesPickup && !matchesDelivery) return false;
			}
			return true;
		})
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">All Services</h1>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : 'New Service'}
		</Button>
	</div>

	{#if showForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>Create Service</Card.Title>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleCreateService} class="space-y-4">
					{#if formError}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{formError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="client">Client *</Label>
						<select
							id="client"
							bind:value={selectedClientId}
							onchange={handleClientSelect}
							required
							disabled={formLoading}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="">Select a client</option>
							{#each clients as client}
								<option value={client.id}>{client.name}</option>
							{/each}
						</select>
					</div>

					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="pickup">Pickup Location *</Label>
							<Input
								id="pickup"
								type="text"
								bind:value={pickupLocation}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="delivery">Delivery Location *</Label>
							<Input
								id="delivery"
								type="text"
								bind:value={deliveryLocation}
								required
								disabled={formLoading}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="notes">Notes</Label>
						<Input
							id="notes"
							type="text"
							bind:value={notes}
							disabled={formLoading}
						/>
					</div>

					<Button type="submit" disabled={formLoading}>
						{formLoading ? 'Creating...' : 'Create Service'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Filters -->
	<div class="flex flex-wrap gap-4">
		<div class="flex-1 min-w-[200px]">
			<Input
				type="search"
				placeholder="Search..."
				bind:value={searchQuery}
			/>
		</div>
		<select
			bind:value={statusFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">All Status</option>
			<option value="pending">Pending</option>
			<option value="delivered">Delivered</option>
		</select>
		<select
			bind:value={clientFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">All Clients</option>
			{#each clients as client}
				<option value={client.id}>{client.name}</option>
			{/each}
		</select>
	</div>

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<p class="text-center text-muted-foreground py-8">Loading...</p>
		{:else if filteredServices.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					No services found
				</Card.Content>
			</Card.Root>
		{:else}
			<p class="text-sm text-muted-foreground">
				Showing {filteredServices.length} service{filteredServices.length === 1 ? '' : 's'}
			</p>
			{#each filteredServices as service}
				<Card.Root class="overflow-hidden">
					<button
						class="w-full text-left"
						onclick={() => toggleStatus(service)}
					>
						<Card.Content class="flex items-start gap-4 p-4">
							<div
								class="mt-1 size-4 shrink-0 rounded-full {service.status === 'pending'
									? 'bg-blue-500'
									: 'bg-green-500'}"
							></div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<p class="font-medium truncate">
										{service.profiles?.name || 'Unknown'}
									</p>
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted-foreground">
											{new Date(service.created_at).toLocaleDateString()}
										</span>
										<span
											class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
											'pending'
												? 'bg-blue-500/10 text-blue-500'
												: 'bg-green-500/10 text-green-500'}"
										>
											{service.status}
										</span>
									</div>
								</div>
								<p class="text-sm text-muted-foreground truncate">
									{service.pickup_location} &rarr; {service.delivery_location}
								</p>
								{#if service.notes}
									<p class="mt-1 text-sm text-muted-foreground">{service.notes}</p>
								{/if}
							</div>
						</Card.Content>
					</button>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
