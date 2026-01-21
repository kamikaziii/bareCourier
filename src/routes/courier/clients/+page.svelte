<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let clients = $state<any[]>([]);
	let loading = $state(true);
	let showForm = $state(false);

	// Form fields
	let email = $state('');
	let name = $state('');
	let phone = $state('');
	let defaultPickupLocation = $state('');
	let password = $state('');
	let formLoading = $state(false);
	let formError = $state('');
	let formSuccess = $state('');

	async function loadClients() {
		loading = true;
		const { data: result } = await data.supabase
			.from('profiles')
			.select('*')
			.eq('role', 'client')
			.order('name');

		clients = result || [];
		loading = false;
	}

	async function handleCreateClient(e: Event) {
		e.preventDefault();
		formLoading = true;
		formError = '';
		formSuccess = '';

		// Get session token for edge function auth
		const { data: sessionData } = await data.supabase.auth.getSession();
		const accessToken = sessionData.session?.access_token;

		if (!accessToken) {
			formError = 'Session expired. Please log in again.';
			formLoading = false;
			return;
		}

		// Call edge function to create client (uses admin API, no confirmation email)
		const response = await fetch(
			`${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/create-client`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify({
					email,
					password,
					name,
					phone: phone || null,
					default_pickup_location: defaultPickupLocation || null
				})
			}
		);

		const result = await response.json();

		if (!response.ok) {
			formError = result.error || 'Failed to create client';
			formLoading = false;
			return;
		}

		formSuccess = 'Client created successfully! They can now log in.';
		formLoading = false;

		// Reset form
		email = '';
		name = '';
		phone = '';
		defaultPickupLocation = '';
		password = '';

		// Reload clients list
		await loadClients();
	}

	async function toggleClientActive(client: any) {
		await data.supabase
			.from('profiles')
			.update({ active: !client.active })
			.eq('id', client.id);
		await loadClients();
	}

	$effect(() => {
		loadClients();
	});

	const activeClients = $derived(clients.filter((c) => c.active));
	const inactiveClients = $derived(clients.filter((c) => !c.active));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Clients</h1>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : 'Add Client'}
		</Button>
	</div>

	{#if showForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>Add New Client</Card.Title>
				<Card.Description>Create a new client account</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={handleCreateClient} class="space-y-4">
					{#if formError}
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{formError}
						</div>
					{/if}
					{#if formSuccess}
						<div class="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
							{formSuccess}
						</div>
					{/if}

					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="email">Email *</Label>
							<Input
								id="email"
								type="email"
								bind:value={email}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="password">Password *</Label>
							<Input
								id="password"
								type="password"
								bind:value={password}
								required
								disabled={formLoading}
								minlength={6}
							/>
						</div>
						<div class="space-y-2">
							<Label for="name">Name *</Label>
							<Input
								id="name"
								type="text"
								bind:value={name}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="phone">Phone</Label>
							<Input
								id="phone"
								type="tel"
								bind:value={phone}
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2 md:col-span-2">
							<Label for="pickup">Default Pickup Location</Label>
							<Input
								id="pickup"
								type="text"
								placeholder="Client's lab address"
								bind:value={defaultPickupLocation}
								disabled={formLoading}
							/>
						</div>
					</div>

					<Button type="submit" disabled={formLoading}>
						{formLoading ? 'Creating...' : 'Create Client'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Active Clients -->
	<div class="space-y-3">
		<h2 class="text-lg font-semibold">Active Clients ({activeClients.length})</h2>
		{#if loading}
			<p class="text-center text-muted-foreground py-4">Loading...</p>
		{:else if activeClients.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					No active clients
				</Card.Content>
			</Card.Root>
		{:else}
			{#each activeClients as client}
				<Card.Root>
					<Card.Content class="flex items-center justify-between p-4">
						<div>
							<p class="font-medium">{client.name}</p>
							<p class="text-sm text-muted-foreground">
								{client.phone || 'No phone'}
								{#if client.default_pickup_location}
									&middot; {client.default_pickup_location}
								{/if}
							</p>
						</div>
						<Button variant="ghost" size="sm" onclick={() => toggleClientActive(client)}>
							Deactivate
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>

	<!-- Inactive Clients -->
	{#if inactiveClients.length > 0}
		<div class="space-y-3">
			<h2 class="text-lg font-semibold text-muted-foreground">Inactive ({inactiveClients.length})</h2>
			{#each inactiveClients as client}
				<Card.Root class="opacity-60">
					<Card.Content class="flex items-center justify-between p-4">
						<div>
							<p class="font-medium">{client.name}</p>
							<p class="text-sm text-muted-foreground">{client.phone || 'No phone'}</p>
						</div>
						<Button variant="ghost" size="sm" onclick={() => toggleClientActive(client)}>
							Reactivate
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
