<script lang="ts">
	import { PUBLIC_SUPABASE_URL } from '$env/static/public';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import PricingConfigForm from '$lib/components/PricingConfigForm.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { PricingModel, Profile } from '$lib/database.types.js';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import { ChevronRight, ChevronDown, Euro, Users } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();

	let clients = $state<Profile[]>([]);
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

	// Pricing section
	let showPricingSection = $state(false);
	let pendingPricingConfig: { pricing_model: PricingModel; base_fee: number; per_km_rate: number } | null = $state(null);
	let pendingPricingZones: { min_km: number; max_km: number | null; price: number }[] = $state([]);

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
			formError = m.session_expired();
			formLoading = false;
			return;
		}

		// Call edge function to create client (uses admin API, no confirmation email)
		const response = await fetch(
			`${PUBLIC_SUPABASE_URL}/functions/v1/create-client`,
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
			formError = result.error || m.error_create_client_failed();
			formLoading = false;
			return;
		}

		// If pricing config was set, save it for the new client
		if (pendingPricingConfig && result.user?.id) {
			try {
				// Save pricing configuration
				const { error: pricingError } = await data.supabase.from('client_pricing').upsert(
					{
						client_id: result.user.id,
						pricing_model: pendingPricingConfig.pricing_model,
						base_fee: pendingPricingConfig.base_fee,
						per_km_rate: pendingPricingConfig.per_km_rate
					},
					{ onConflict: 'client_id' }
				);

				if (pricingError) {
					console.error('Pricing save error:', pricingError);
				}

				// If zone pricing, save zones
				if (pendingPricingConfig.pricing_model === 'zone' && pendingPricingZones.length > 0) {
					const { error: zonesError } = await data.supabase.rpc('replace_pricing_zones', {
						p_client_id: result.user.id,
						p_zones: pendingPricingZones
					});

					if (zonesError) {
						console.error('Zones save error:', zonesError);
					}
				}
			} catch (err) {
				console.error('Failed to save pricing:', err);
			}
		}

		formSuccess = m.clients_success();
		formLoading = false;

		// Reset form
		email = '';
		name = '';
		phone = '';
		defaultPickupLocation = '';
		password = '';
		showPricingSection = false;
		pendingPricingConfig = null;
		pendingPricingZones = [];

		// Reload clients list
		await loadClients();
	}

	function handlePricingChange(
		config: { pricing_model: PricingModel; base_fee: number; per_km_rate: number },
		zones: { min_km: number; max_km: number | null; price: number }[]
	) {
		pendingPricingConfig = config;
		pendingPricingZones = zones;
		return Promise.resolve();
	}

	async function toggleClientActive(client: Profile) {
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

<PullToRefresh>
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.clients_title()}</h1>
		<Button onclick={() => (showForm = !showForm)}>
			{showForm ? m.services_cancel() : m.clients_add()}
		</Button>
	</div>

	{#if showForm}
		<Card.Root>
			<Card.Header>
				<Card.Title>{m.clients_add_form_title()}</Card.Title>
				<Card.Description>{m.clients_add_form_subtitle()}</Card.Description>
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
							<Label for="email">{m.auth_email()} *</Label>
							<Input
								id="email"
								type="email"
								bind:value={email}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="password">{m.auth_password()} *</Label>
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
							<Label for="name">{m.form_name()} *</Label>
							<Input
								id="name"
								type="text"
								bind:value={name}
								required
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="phone">{m.form_phone()}</Label>
							<Input
								id="phone"
								type="tel"
								bind:value={phone}
								disabled={formLoading}
							/>
						</div>
						<div class="space-y-2 md:col-span-2">
							<Label for="pickup">{m.form_pickup_location()}</Label>
							<Input
								id="pickup"
								type="text"
								placeholder={m.clients_default_location()}
								bind:value={defaultPickupLocation}
								disabled={formLoading}
							/>
						</div>
					</div>

					<!-- Pricing Configuration (Collapsible) -->
					<Separator />

					<div class="space-y-4">
						<button
							type="button"
							class="flex w-full items-center justify-between text-left"
							onclick={() => (showPricingSection = !showPricingSection)}
							disabled={formLoading}
						>
							<div class="flex items-center gap-2">
								<Euro class="size-5 text-muted-foreground" />
								<span class="font-medium">{m.billing_pricing_config()}</span>
								<Badge variant="secondary">{m.schedule_optional()}</Badge>
							</div>
							<ChevronDown
								class="size-5 text-muted-foreground transition-transform {showPricingSection
									? 'rotate-180'
									: ''}"
							/>
						</button>

						{#if showPricingSection}
							<div class="rounded-md border p-4">
								<p class="mb-4 text-sm text-muted-foreground">{m.billing_pricing_config_desc()}</p>
								<PricingConfigForm
									onSave={handlePricingChange}
									compact={true}
								/>
								{#if pendingPricingConfig}
									<p class="mt-2 text-xs text-green-600">{m.billing_configured()}</p>
								{/if}
							</div>
						{/if}
					</div>

					<Button type="submit" disabled={formLoading}>
						{formLoading ? m.clients_creating() : m.clients_create()}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Active Clients -->
	<div class="space-y-3">
		<h2 class="text-lg font-semibold">{m.clients_active()} ({loading ? '...' : activeClients.length})</h2>
		{#if loading}
			<SkeletonList variant="client" count={3} />
		{:else if activeClients.length === 0}
			<EmptyState
				icon={Users}
				title={m.clients_no_active()}
			/>
		{:else}
			{#each activeClients as client (client.id)}
				<a href={localizeHref(`/courier/clients/${client.id}`)} class="block">
					<Card.Root class="transition-colors hover:bg-muted/50">
						<Card.Content class="flex items-center justify-between p-4">
							<div class="min-w-0 flex-1">
								<p class="font-medium">{client.name}</p>
								<p class="text-sm text-muted-foreground truncate">
									{client.phone || m.clients_no_phone()}
									{#if client.default_pickup_location}
										&middot; {client.default_pickup_location}
									{/if}
								</p>
							</div>
							<ChevronRight class="size-5 text-muted-foreground" />
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		{/if}
	</div>

	<!-- Inactive Clients -->
	{#if inactiveClients.length > 0}
		<div class="space-y-3">
			<h2 class="text-lg font-semibold text-muted-foreground">{m.clients_inactive()} ({inactiveClients.length})</h2>
			{#each inactiveClients as client (client.id)}
				<a href={localizeHref(`/courier/clients/${client.id}`)} class="block">
					<Card.Root class="opacity-60 transition-colors hover:bg-muted/50">
						<Card.Content class="flex items-center justify-between p-4">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium">{client.name}</p>
									<Badge variant="secondary">{m.clients_inactive()}</Badge>
								</div>
								<p class="text-sm text-muted-foreground">{client.phone || m.clients_no_phone()}</p>
							</div>
							<ChevronRight class="size-5 text-muted-foreground" />
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
</PullToRefresh>
