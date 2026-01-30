<script lang="ts">
	import { browser } from '$app/environment';
	import { goto, invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { Service, TimeSlot } from '$lib/database.types';
	import { Check, RotateCcw, Loader2, CheckSquare, CalendarClock } from '@lucide/svelte';
	import { formatDate, formatTimeSlot } from '$lib/utils.js';
	import ServiceCard from '$lib/components/ServiceCard.svelte';
	import { cacheServices, applyOptimisticUpdate, rollbackOptimisticUpdate } from '$lib/services/offline-store';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import SkeletonList from '$lib/components/SkeletonList.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte.js';
	import { sortByUrgency, settingsToConfig, type PastDueConfig } from '$lib/utils/past-due.js';
	import WorkloadCard from '$lib/components/WorkloadCard.svelte';
	import { calculateDayWorkload, getWorkloadSettings, type WorkloadEstimate } from '$lib/services/workload.js';

	let { data }: { data: PageData } = $props();

	const pastDueConfig = $derived(settingsToConfig(data.profile.past_due_settings, data.profile.time_slots));

	// Service with joined profile data
	type ServiceWithProfile = Service & { profiles: { name: string } | null };

	let filter = $state<'today' | 'tomorrow' | 'all'>('today');
	let services = $derived(data.services);
	let loading = $state(false);
	// Track which services are currently syncing
	let syncingIds = $state<Set<string>>(new Set());
	// Workload state
	let workload = $state<WorkloadEstimate | null>(null);
	let workloadLoading = $state(true);

	// Batch selection
	const batch = useBatchSelection();

	function selectAllVisible() {
		batch.selectAll(sortedServices.filter(s => s.status === 'pending').map(s => s.id));
	}

	// Batch reschedule dialog state
	let showBatchRescheduleDialog = $state(false);
	let batchRescheduleDate = $state<string | null>(null);
	let batchRescheduleTimeSlot = $state<TimeSlot | null>(null);
	let batchRescheduleTime = $state<string | null>(null);
	let batchRescheduleReason = $state('');
	let batchRescheduleLoading = $state(false);
	let batchRescheduleSuccess = $state<string | null>(null);
	let batchRescheduleError = $state<string | null>(null);

	function openBatchRescheduleDialog() {
		batchRescheduleDate = null;
		batchRescheduleTimeSlot = null;
		batchRescheduleTime = null;
		batchRescheduleReason = '';
		showBatchRescheduleDialog = true;
	}

	async function handleBatchReschedule() {
		if (!batchRescheduleDate || !batchRescheduleTimeSlot || !batch.hasSelection) return;
		if (batchRescheduleTimeSlot === 'specific' && !batchRescheduleTime) return;

		batchRescheduleLoading = true;
		batchRescheduleError = null;
		batchRescheduleSuccess = null;

		const formData = new FormData();
		formData.set('service_ids', JSON.stringify(Array.from(batch.selectedIds)));
		formData.set('date', batchRescheduleDate);
		formData.set('time_slot', batchRescheduleTimeSlot);
		if (batchRescheduleTime) formData.set('time', batchRescheduleTime);
		formData.set('reason', batchRescheduleReason);

		try {
			const response = await fetch('?/batchReschedule', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			if (result.data?.success) {
				batchRescheduleSuccess = m.reschedule_success();
				// Reload from server
				await invalidate('app:services');
				showBatchRescheduleDialog = false;
				batch.reset();
				// Clear success message after 3 seconds
				setTimeout(() => {
					batchRescheduleSuccess = null;
				}, 3000);
			} else {
				batchRescheduleError = result.data?.error || m.reschedule_error();
			}
		} catch (error) {
			console.error('Batch reschedule error:', error);
			batchRescheduleError = m.reschedule_error();
		}

		batchRescheduleLoading = false;
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const dayAfter = new Date(tomorrow);
	dayAfter.setDate(dayAfter.getDate() + 1);

	async function loadWorkload() {
		workloadLoading = true;
		const settings = getWorkloadSettings(data.profile.workload_settings);
		workload = await calculateDayWorkload(data.supabase, data.profile.id, new Date(), settings);
		workloadLoading = false;
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

			// Refresh workload after status change
			loadWorkload();
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

	// Track if workload has been loaded (only needs to load once since it's always for today)
	let workloadLoaded = false;

	$effect(() => {
		if (!workloadLoaded) {
			workloadLoaded = true;
			loadWorkload();
		}
	});

	// Listen for sync completion from service worker
	$effect(() => {
		if (!browser) return;

		function handleSyncComplete(event: MessageEvent) {
			if (event.data?.type === 'SYNC_COMPLETE') {
				// Reload services and workload when sync completes
				invalidate('app:services');
				loadWorkload();
			}
		}

		navigator.serviceWorker?.addEventListener('message', handleSyncComplete);

		return () => {
			navigator.serviceWorker?.removeEventListener('message', handleSyncComplete);
		};
	});

	// Client-side filtering for instant filter changes
	const filteredServices = $derived.by(() => {
		const todayStr = today.toISOString().split('T')[0];
		const tomorrowStr = tomorrow.toISOString().split('T')[0];

		if (filter === 'today') {
			return services.filter(s => {
				if (s.scheduled_date === todayStr) return true;
				if (!s.scheduled_date && s.created_at) {
					const createdDate = new Date(s.created_at);
					return createdDate >= today && createdDate < tomorrow;
				}
				return false;
			});
		} else if (filter === 'tomorrow') {
			return services.filter(s => {
				if (s.scheduled_date === tomorrowStr) return true;
				if (!s.scheduled_date && s.created_at) {
					const createdDate = new Date(s.created_at);
					return createdDate >= tomorrow && createdDate < dayAfter;
				}
				return false;
			});
		}

		return services; // 'all' filter
	});

	const pendingCount = $derived(filteredServices.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(filteredServices.filter((s) => s.status === 'delivered').length);
	const sortedServices = $derived(sortByUrgency(filteredServices, pastDueConfig));

</script>

<PullToRefresh>
<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.dashboard_title()}</h1>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3">
		{#if loading}
			<SkeletonCard variant="stat" />
			<SkeletonCard variant="stat" />
		{:else}
			<Card.Root>
				<Card.Content class="flex items-center gap-3 p-4">
					<div class="size-8 rounded-full bg-blue-500/10 flex items-center justify-center">
						<div class="size-3 rounded-full bg-blue-500"></div>
					</div>
					<div>
						<p class="text-xl font-bold">{pendingCount}</p>
						<p class="text-sm text-muted-foreground">{m.status_pending()}</p>
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Content class="flex items-center gap-3 p-4">
					<div class="size-8 rounded-full bg-green-500/10 flex items-center justify-center">
						<div class="size-3 rounded-full bg-green-500"></div>
					</div>
					<div>
						<p class="text-xl font-bold">{deliveredCount}</p>
						<p class="text-sm text-muted-foreground">{m.status_delivered()}</p>
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>

	<!-- Workload Card -->
	{#if workloadLoading}
		<SkeletonCard variant="stat" />
	{:else if workload}
		<WorkloadCard {workload} />
	{/if}

	<!-- Filters -->
	<div class="flex items-center gap-2">
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

		<div class="ml-auto"></div>

		<!-- Selection Mode Toggle -->
		<Button
			variant={batch.selectionMode ? 'default' : 'outline'}
			size="sm"
			onclick={batch.toggleSelectionMode}
		>
			<CheckSquare class="size-4 sm:mr-1" />
			<span class="hidden sm:inline">{batch.selectionMode ? m.batch_deselect_all() : m.batch_selection_mode()}</span>
		</Button>
	</div>

	<!-- Selection Toolbar (when selection mode active) -->
	{#if batch.selectionMode}
		<div class="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/50 p-2">
			<Button
				variant="outline"
				size="sm"
				onclick={selectAllVisible}
			>
				{m.batch_select_all()}
			</Button>

			{#if batch.hasSelection}
				<span class="text-sm text-muted-foreground">
					{m.batch_selected_count({ count: batch.selectedCount })}
				</span>
				<Button size="sm" onclick={openBatchRescheduleDialog}>
					<CalendarClock class="size-4 mr-1" />
					{m.batch_reschedule()}
				</Button>
				<Button size="sm" variant="ghost" onclick={batch.deselectAll}>
					{m.batch_deselect_all()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Batch operation feedback messages -->
	{#if batchRescheduleSuccess}
		<div class="rounded-md bg-green-500/10 p-3 text-green-600">
			{batchRescheduleSuccess}
		</div>
	{/if}
	{#if batchRescheduleError}
		<div class="rounded-md bg-destructive/10 p-3 text-destructive">
			{batchRescheduleError}
		</div>
	{/if}

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
				<ServiceCard
					{service}
					showClientName={true}
					selectable={batch.selectionMode}
					selected={batch.has(service.id)}
					onToggle={() => batch.toggle(service.id)}
					onClick={() => { goto(localizeHref(`/courier/services/${service.id}`)); }}
				>
					{#snippet headerActions()}
						{#if !batch.selectionMode}
							<button
								type="button"
								onclick={(e: Event) => { e.stopPropagation(); toggleStatus(service, e); }}
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
						{/if}
					{/snippet}
					{#snippet urgencyBadge()}
						<UrgencyBadge service={service} size="sm" config={pastDueConfig} />
					{/snippet}
				</ServiceCard>
			{/each}
		{/if}
	</div>
</div>

<!-- Batch Reschedule Dialog -->
<Dialog.Root bind:open={showBatchRescheduleDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.batch_reschedule()}
			</Dialog.Title>
			<Dialog.Description>
				{m.batch_reschedule_desc({ count: batch.selectedCount })}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<SchedulePicker
				selectedDate={batchRescheduleDate}
				selectedTimeSlot={batchRescheduleTimeSlot}
				selectedTime={batchRescheduleTime}
				onDateChange={(date) => (batchRescheduleDate = date)}
				onTimeSlotChange={(slot) => (batchRescheduleTimeSlot = slot)}
				onTimeChange={(time) => (batchRescheduleTime = time)}
			/>

			<div class="space-y-2">
				<Label for="batch-reason">{m.reschedule_reason()}</Label>
				<Textarea
					id="batch-reason"
					bind:value={batchRescheduleReason}
					placeholder={m.reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showBatchRescheduleDialog = false)} disabled={batchRescheduleLoading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleBatchReschedule} disabled={!batchRescheduleDate || !batchRescheduleTimeSlot || (batchRescheduleTimeSlot === 'specific' && !batchRescheduleTime) || batchRescheduleLoading}>
				{batchRescheduleLoading ? m.saving() : m.batch_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
</PullToRefresh>
