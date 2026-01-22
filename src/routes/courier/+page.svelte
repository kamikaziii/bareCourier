<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let filter = $state<'today' | 'tomorrow' | 'all'>('today');
	let services = $state<any[]>([]);
	let loading = $state(true);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const dayAfter = new Date(tomorrow);
	dayAfter.setDate(dayAfter.getDate() + 1);

	async function loadServices() {
		loading = true;
		let query = data.supabase
			.from('services')
			.select('*, profiles!client_id(name)')
			.order('created_at', { ascending: false });

		if (filter === 'today') {
			query = query.gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString());
		} else if (filter === 'tomorrow') {
			query = query.gte('created_at', tomorrow.toISOString()).lt('created_at', dayAfter.toISOString());
		}

		const { data: result } = await query;
		services = result || [];
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
		await loadServices();
	}

	$effect(() => {
		loadServices();
	});

	const pendingCount = $derived(services.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(services.filter((s) => s.status === 'delivered').length);

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.dashboard_title()}</h1>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Content class="flex items-center gap-4 p-6">
				<div class="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
					<div class="size-4 rounded-full bg-blue-500"></div>
				</div>
				<div>
					<p class="text-2xl font-bold">{pendingCount}</p>
					<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
				</div>
			</Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Content class="flex items-center gap-4 p-6">
				<div class="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
					<div class="size-4 rounded-full bg-green-500"></div>
				</div>
				<div>
					<p class="text-2xl font-bold">{deliveredCount}</p>
					<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Filters -->
	<div class="flex gap-2">
		<Button
			variant={filter === 'today' ? 'default' : 'outline'}
			size="sm"
			onclick={() => (filter = 'today')}
		>
			{m.dashboard_today()}
		</Button>
		<Button
			variant={filter === 'tomorrow' ? 'default' : 'outline'}
			size="sm"
			onclick={() => (filter = 'tomorrow')}
		>
			{m.dashboard_tomorrow()}
		</Button>
		<Button
			variant={filter === 'all' ? 'default' : 'outline'}
			size="sm"
			onclick={() => (filter = 'all')}
		>
			{m.dashboard_all()}
		</Button>
	</div>

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<p class="text-center text-muted-foreground py-8">{m.loading()}</p>
		{:else if services.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					{m.dashboard_no_services()}
				</Card.Content>
			</Card.Root>
		{:else}
			{#each services as service (service.id)}
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
										{service.profiles?.name || m.unknown_client()}
									</p>
									<span
										class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
										'pending'
											? 'bg-blue-500/10 text-blue-500'
											: 'bg-green-500/10 text-green-500'}"
									>
										{getStatusLabel(service.status)}
									</span>
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
