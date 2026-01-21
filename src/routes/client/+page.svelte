<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let services = $state<any[]>([]);
	let loading = $state(true);

	async function loadServices() {
		loading = true;
		const { data: result } = await data.supabase
			.from('services')
			.select('*')
			.order('created_at', { ascending: false });

		services = result || [];
		loading = false;
	}

	$effect(() => {
		loadServices();
	});

	const pendingCount = $derived(services.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(services.filter((s) => s.status === 'delivered').length);

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale());
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString(getLocale());
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.client_my_services()}</h1>
		<Button onclick={() => goto(localizeHref('/client/new'))}>{m.client_new_request()}</Button>
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

	<!-- Services List -->
	<div class="space-y-3">
		{#if loading}
			<p class="text-center text-muted-foreground py-8">{m.loading()}</p>
		{:else if services.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center">
					<p class="text-muted-foreground mb-4">{m.client_no_services()}</p>
					<Button onclick={() => goto(localizeHref('/client/new'))}>{m.client_first_request()}</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			{#each services as service}
				<Card.Root>
					<Card.Content class="flex items-start gap-4 p-4">
						<div
							class="mt-1 size-4 shrink-0 rounded-full {service.status === 'pending'
								? 'bg-blue-500'
								: 'bg-green-500'}"
						></div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center justify-between gap-2">
								<p class="font-medium">
									{formatDate(service.created_at)}
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
							{#if service.delivered_at}
								<p class="mt-1 text-xs text-muted-foreground">
									{m.client_delivered_at({ datetime: formatDateTime(service.delivered_at) })}
								</p>
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
