<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { Service } from '$lib/database.types';
	import { Check, RotateCcw, Loader2 } from '@lucide/svelte';
	import { cacheServices, applyOptimisticUpdate, rollbackOptimisticUpdate } from '$lib/services/offline-store';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
	import { sortByUrgency } from '$lib/utils/past-due.js';

	let { data }: { data: PageData } = $props();

	// Service with joined profile data
	type ServiceWithProfile = Service & { profiles: { name: string } | null };

	let filter = $state<'today' | 'tomorrow' | 'all'>('today');
	let services = $state<ServiceWithProfile[]>([]);
	let loading = $state(true);
	// Track which services are currently syncing
	let syncingIds = $state<Set<string>>(new Set());

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
			.is('deleted_at', null);

		// Format dates as YYYY-MM-DD for scheduled_date comparison
		const todayStr = today.toISOString().split('T')[0];
		const tomorrowStr = tomorrow.toISOString().split('T')[0];
		const dayAfterStr = dayAfter.toISOString().split('T')[0];

		if (filter === 'today') {
			// Services scheduled for today OR unscheduled services created today
			query = query.or(
				`scheduled_date.eq.${todayStr},and(scheduled_date.is.null,created_at.gte.${today.toISOString()},created_at.lt.${tomorrow.toISOString()})`
			);
		} else if (filter === 'tomorrow') {
			// Services scheduled for tomorrow OR unscheduled services created tomorrow
			query = query.or(
				`scheduled_date.eq.${tomorrowStr},and(scheduled_date.is.null,created_at.gte.${tomorrow.toISOString()},created_at.lt.${dayAfter.toISOString()})`
			);
		}

		// Order by scheduled_date first (nulls last), then by created_at descending
		query = query
			.order('scheduled_date', { ascending: true, nullsFirst: false })
			.order('created_at', { ascending: false });

		const { data: result } = await query;
		services = result || [];
		loading = false;

		// Cache services for offline access
		if (browser && result) {
			cacheServices(result);
		}
	}

	async function toggleStatus(service: ServiceWithProfile, e: Event) {
		e.preventDefault();
		e.stopPropagation();

		const newStatus = service.status === 'pending' ? 'delivered' : 'pending';
		const updates: Partial<Service> = { status: newStatus };

		if (newStatus === 'delivered') {
			updates.delivered_at = new Date().toISOString();
		} else {
			updates.delivered_at = null;
		}

		// Store original values for potential rollback
		const originalStatus = service.status;
		const originalDeliveredAt = service.delivered_at;

		// Optimistic UI update - apply immediately
		const serviceIndex = services.findIndex((s) => s.id === service.id);
		if (serviceIndex !== -1) {
			services[serviceIndex] = { ...services[serviceIndex], ...updates };
		}

		// Mark as syncing
		syncingIds = new Set([...syncingIds, service.id]);

		let mutationId: string | undefined;

		try {
			// Queue for offline sync if available
			if (browser) {
				mutationId = await applyOptimisticUpdate(service.id, updates);
			}

			// Try to sync with server
			const { error } = await data.supabase.from('services').update(updates).eq('id', service.id);

			if (error) {
				throw error;
			}

			// Success - remove from syncing
			syncingIds = new Set([...syncingIds].filter((id) => id !== service.id));
		} catch (err) {
			console.error('Failed to update service:', err);

			// Rollback optimistic update
			if (serviceIndex !== -1) {
				services[serviceIndex] = {
					...services[serviceIndex],
					status: originalStatus,
					delivered_at: originalDeliveredAt
				};
			}

			// Rollback in IndexedDB if we have a mutation ID
			if (browser && mutationId) {
				await rollbackOptimisticUpdate(service.id, mutationId, {
					status: originalStatus,
					delivered_at: originalDeliveredAt
				});
			}

			// Remove from syncing
			syncingIds = new Set([...syncingIds].filter((id) => id !== service.id));
		}
	}

	$effect(() => {
		loadServices();
	});

	// Listen for sync completion from service worker
	$effect(() => {
		if (!browser) return;

		function handleSyncComplete(event: MessageEvent) {
			if (event.data?.type === 'SYNC_COMPLETE') {
				// Reload services when sync completes
				loadServices();
			}
		}

		navigator.serviceWorker?.addEventListener('message', handleSyncComplete);

		return () => {
			navigator.serviceWorker?.removeEventListener('message', handleSyncComplete);
		};
	});

	const pendingCount = $derived(services.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(services.filter((s) => s.status === 'delivered').length);
	const sortedServices = $derived(sortByUrgency(services));

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}
</script>

<PullToRefresh>
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.dashboard_title()}</h1>
	</div>

	<!-- Stats -->
	<div class="grid gap-4 md:grid-cols-2">
		{#if loading}
			<SkeletonCard variant="stat" />
			<SkeletonCard variant="stat" />
		{:else}
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
		{/if}
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
			<SkeletonList variant="service" count={3} />
		{:else if services.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-muted-foreground">
					{m.dashboard_no_services()}
				</Card.Content>
			</Card.Root>
		{:else}
			{#each sortedServices as service (service.id)}
				<a href={localizeHref(`/courier/services/${service.id}`)} class="block group">
					<Card.Root class="overflow-hidden transition-colors group-hover:bg-muted/50">
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
										<UrgencyBadge service={service} size="sm" />
										<span
											class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
											'pending'
												? 'bg-blue-500/10 text-blue-500'
												: 'bg-green-500/10 text-green-500'}"
										>
											{getStatusLabel(service.status)}
										</span>
										<button
											type="button"
											onclick={(e: Event) => toggleStatus(service, e)}
											disabled={syncingIds.has(service.id)}
											class="shrink-0 size-8 flex items-center justify-center rounded-md border transition-colors
												{syncingIds.has(service.id)
													? 'opacity-50 cursor-wait'
													: service.status === 'pending'
														? 'hover:bg-green-500/10 hover:border-green-500 hover:text-green-500'
														: 'hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-500'}
												text-muted-foreground"
											title={service.status === 'pending' ? m.mark_delivered() : m.mark_pending()}
										>
											{#if syncingIds.has(service.id)}
												<Loader2 class="size-4 animate-spin" />
											{:else if service.status === 'pending'}
												<Check class="size-4" />
											{:else}
												<RotateCcw class="size-4" />
											{/if}
										</button>
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
					</Card.Root>
				</a>
			{/each}
		{/if}
	</div>
</div>
</PullToRefresh>
