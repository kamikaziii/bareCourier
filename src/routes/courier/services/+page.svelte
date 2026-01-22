<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
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
				.is('deleted_at', null)
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

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale());
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.services_title()}</h1>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? m.services_cancel() : m.services_new()}
		</Button>
	</div>

	{#if showForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.services_create()}</Card.Title>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleCreateService} class="space-y-4">
					{#if formError}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{formError}
						</div>
					{/if}

					<div class="space-y-2">
						<Label for="client">{m.form_client()} *</Label>
						<select
							id="client"
							bind:value={selectedClientId}
							onchange={handleClientSelect}
							required
							disabled={formLoading}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							<option value="">{m.form_select_client()}</option>
							{#each clients as client (client.id)}
								<option value={client.id}>{client.name}</option>
							{/each}
						</select>
					</div>

					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="pickup">{m.form_pickup_location()} *</Label>
							<Input
								id="pickup"
								type="text"
								bind:value={pickupLocation}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="delivery">{m.form_delivery_location()} *</Label>
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
						<Label for="notes">{m.form_notes()}</Label>
						<Input
							id="notes"
							type="text"
							bind:value={notes}
							disabled={formLoading}
						/>
					</div>

					<Button type="submit" disabled={formLoading}>
						{formLoading ? m.services_creating() : m.services_create()}
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
				placeholder={m.services_search()}
				bind:value={searchQuery}
			/>
		</div>
		<select
			bind:value={statusFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">{m.services_all_status()}</option>
			<option value="pending">{m.status_pending()}</option>
			<option value="delivered">{m.status_delivered()}</option>
		</select>
		<select
			bind:value={clientFilter}
			class="h-10 rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="all">{m.services_all_clients()}</option>
			{#each clients as client (client.id)}
				<option value={client.id}>{client.name}</option>
			{/each}
		</select>
	</div>

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<p class="text-center text-muted-foreground py-8">{m.loading()}</p>
		{:else if filteredServices.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					{m.services_no_results()}
				</Card.Content>
			</Card.Root>
		{:else}
			<p class="text-sm text-muted-foreground">
				{m.services_showing({ count: filteredServices.length })}
			</p>
			{#each filteredServices as service (service.id)}
				<a href={localizeHref(`/courier/services/${service.id}`)} class="block">
					<Card.Root class="overflow-hidden transition-colors hover:bg-muted/50">
						<Card.Content class="flex items-start gap-4 p-4">
							<div
								class="mt-1 size-4 shrink-0 rounded-full {service.status === 'pending'
									? 'bg-blue-500'
									: 'bg-green-500'}"
							></div>
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<p class="font-medium truncate">
										{service.profiles?.name || m.unknown_client()}
									</p>
									<div class="flex items-center gap-2">
										<span class="text-xs text-muted-foreground">
											{formatDate(service.created_at)}
										</span>
										<Badge
											variant="outline"
											class={service.status === 'pending'
												? 'border-blue-500 text-blue-500'
												: 'border-green-500 text-green-500'}
										>
											{getStatusLabel(service.status)}
										</Badge>
									</div>
								</div>
								<p class="text-sm text-muted-foreground truncate">
									{service.pickup_location} &rarr; {service.delivery_location}
								</p>
								{#if service.notes}
									<p class="mt-1 text-sm text-muted-foreground truncate">{service.notes}</p>
								{/if}
							</div>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		{/if}
	</div>
</div>
