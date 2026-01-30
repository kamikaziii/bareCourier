<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { Profile } from '$lib/database.types.js';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import { ChevronRight, Users, Plus } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();

	let clients = $state<Profile[]>([]);
	let loading = $state(true);

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
		<Button href={localizeHref('/courier/clients/new')}>
			<Plus class="mr-2 size-4" />
			{m.clients_add()}
		</Button>
	</div>

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
