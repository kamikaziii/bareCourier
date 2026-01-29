<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { CheckSquare, Inbox } from '@lucide/svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import WorkloadSummary from '$lib/components/WorkloadSummary.svelte';
	import { useBatchSelection } from '$lib/composables/use-batch-selection.svelte.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { formatDateWithWeekday, formatDate } from '$lib/utils.js';
	import type { PageData } from './$types';
	import type { Service, Profile, TimeSlot } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	type ServiceWithClient = Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> };

	let loading = $state(false);
	let actionError = $state('');

	// Dialog states
	let showAcceptDialog = $state(false);
	let showRejectDialog = $state(false);
	let showSuggestDialog = $state(false);
	let selectedService = $state<ServiceWithClient | null>(null);

	// Batch selection
	const batch = useBatchSelection();
	let batchLoading = $state(false);
	let batchMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	function selectAllRequests() {
		batch.selectAll(data.pendingRequests.map((s: ServiceWithClient) => s.id));
	}

	async function handleBatchAccept() {
		if (!batch.hasSelection) return;
		batchLoading = true;
		batchMessage = null;

		const formData = new FormData();
		formData.set('service_ids', JSON.stringify(Array.from(batch.selectedIds)));

		try {
			const response = await fetch('?/batchAccept', { method: 'POST', body: formData });
			const result = await response.json();
			if (result.data?.success) {
				batchMessage = { type: 'success', text: m.batch_accept_success({ count: batch.selectedCount }) };
				batch.reset();
				await invalidateAll();
				setTimeout(() => { batchMessage = null; }, 3000);
			} else {
				batchMessage = { type: 'error', text: result.data?.error || 'Failed' };
			}
		} catch {
			batchMessage = { type: 'error', text: 'An error occurred' };
		}
		batchLoading = false;
	}

	// Form states for dialogs
	let rejectionReason = $state('');
	let suggestedDate = $state<string | null>(null);
	let suggestedTimeSlot = $state<TimeSlot | null>(null);
	let suggestedTime = $state<string | null>(null);

	function formatRequestDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return formatDateWithWeekday(dateStr);
	}

	function formatTimeSlot(slot: string | null): string {
		if (!slot) return '-';
		switch (slot) {
			case 'morning':
				return m.time_slot_morning();
			case 'afternoon':
				return m.time_slot_afternoon();
			case 'evening':
				return m.time_slot_evening();
			case 'specific':
				return m.time_slot_specific();
			default:
				return slot;
		}
	}

	function getWorkloadForService(service: ServiceWithClient): { workload: WorkloadEstimate; label: string } | null {
		if (service.requested_date && data.workloadByDate[service.requested_date]) {
			return {
				workload: data.workloadByDate[service.requested_date],
				label: formatRequestDate(service.requested_date)
			};
		}
		// No date requested - use today's workload
		if (data.workloadByDate[data.todayStr]) {
			return {
				workload: data.workloadByDate[data.todayStr],
				label: m.workload_today()
			};
		}
		return null;
	}

	function openAcceptDialog(service: ServiceWithClient) {
		selectedService = service;
		actionError = '';
		showAcceptDialog = true;
	}

	function openRejectDialog(service: ServiceWithClient) {
		selectedService = service;
		actionError = '';
		rejectionReason = '';
		showRejectDialog = true;
	}

	function openSuggestDialog(service: ServiceWithClient) {
		selectedService = service;
		actionError = '';
		suggestedDate = null;
		suggestedTimeSlot = null;
		suggestedTime = null;
		showSuggestDialog = true;
	}

	async function handleAccept() {
		if (!selectedService) return;
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);

		try {
			const response = await fetch('?/accept', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showAcceptDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to accept request';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	async function handleReject() {
		if (!selectedService) return;
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);
		formData.set('rejection_reason', rejectionReason);

		try {
			const response = await fetch('?/reject', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showRejectDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to reject request';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	async function handleSuggest() {
		if (!selectedService || !suggestedDate || !suggestedTimeSlot) return;
		if (suggestedTimeSlot === 'specific' && !suggestedTime) return;
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);
		formData.set('suggested_date', suggestedDate);
		formData.set('suggested_time_slot', suggestedTimeSlot);
		if (suggestedTime) formData.set('suggested_time', suggestedTime);

		try {
			const response = await fetch('?/suggest', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showSuggestDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to send suggestion';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	// Reschedule denial state
	let showDenyRescheduleDialog = $state(false);
	let denyingService = $state<ServiceWithClient | null>(null);
	let denialReason = $state('');

	function openDenyRescheduleDialog(service: ServiceWithClient) {
		denyingService = service;
		denialReason = '';
		actionError = '';
		showDenyRescheduleDialog = true;
	}

	async function handleApproveReschedule(serviceId: string) {
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', serviceId);

		try {
			const response = await fetch('?/approveReschedule', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
				} else {
					actionError = result.data?.error || 'Failed to approve reschedule';
				}
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	async function handleDenyReschedule() {
		if (!denyingService) return;
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', denyingService.id);
		formData.set('denial_reason', denialReason);

		try {
			const response = await fetch('?/denyReschedule', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showDenyRescheduleDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to deny reschedule';
				}
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{m.requests_title()}</h1>
			<p class="text-muted-foreground">
				{data.pendingRequests.length === 1 ? m.requests_count_one({ count: data.pendingRequests.length }) : m.requests_count_other({ count: data.pendingRequests.length })}
			</p>
		</div>
		{#if data.pendingRequests.length > 0}
			<Button
				variant={batch.selectionMode ? 'default' : 'outline'}
				size="sm"
				onclick={batch.toggleSelectionMode}
			>
				<CheckSquare class="size-4 sm:mr-1" />
				<span class="hidden sm:inline">{batch.selectionMode ? m.batch_deselect_all() : m.batch_selection_mode()}</span>
			</Button>
		{/if}
	</div>

	<!-- Selection Toolbar -->
	{#if batch.selectionMode}
		<div class="flex items-center gap-2 flex-wrap rounded-lg border bg-muted/50 p-2">
			<Button variant="outline" size="sm" onclick={selectAllRequests}>
				{m.batch_select_all()}
			</Button>
			{#if batch.hasSelection}
				<span class="text-sm text-muted-foreground">
					{m.batch_selected_count({ count: batch.selectedCount })}
				</span>
				<Button size="sm" onclick={handleBatchAccept} disabled={batchLoading}>
					{batchLoading ? m.saving() : m.batch_accept()}
				</Button>
				<Button size="sm" variant="ghost" onclick={batch.deselectAll}>
					{m.batch_deselect_all()}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Batch feedback -->
	{#if batchMessage}
		<div class="rounded-md p-3 {batchMessage.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}">
			{batchMessage.text}
		</div>
	{/if}

	{#if data.pendingRequests.length === 0}
		<EmptyState
			icon={Inbox}
			title={m.requests_no_pending()}
		/>
	{:else}
		<div class="grid gap-4">
			{#each data.pendingRequests as service}
				<Card.Root class={batch.has(service.id) ? "ring-2 ring-primary" : ""}>
					<Card.Content class="pt-6">
						<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
							{#if batch.selectionMode}
								<Checkbox
									checked={batch.has(service.id)}
									onCheckedChange={() => batch.toggle(service.id)}
									class="mt-1 shrink-0"
								/>
							{/if}
							<div class="space-y-3 flex-1">
								<!-- Client info -->
								<div class="flex items-center gap-2">
									<a
										href={localizeHref(`/courier/clients/${service.profiles.id}`)}
										class="font-medium hover:underline"
									>
										{service.profiles.name}
									</a>
									{#if service.profiles.phone}
										<span class="text-sm text-muted-foreground">
											{service.profiles.phone}
										</span>
									{/if}
								</div>

								<!-- Route -->
								<div class="text-sm space-y-1">
									<div class="flex items-start gap-2">
										<span class="text-blue-500 font-medium">{m.location_from()}</span>
										<span>{service.pickup_location}</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="text-green-500 font-medium">{m.location_to()}</span>
										<span>{service.delivery_location}</span>
									</div>
								</div>

								<!-- Requested schedule -->
								{#if service.requested_date || service.requested_time_slot}
									<div class="flex items-center gap-2">
										<Badge variant="outline">{m.requests_requested_schedule()}</Badge>
										<span class="text-sm">
											{formatRequestDate(service.requested_date)}
											{#if service.requested_time_slot}
												- {formatTimeSlot(service.requested_time_slot)}
											{/if}
											{#if service.requested_time}
												({service.requested_time})
											{/if}
										</span>
									</div>
								{/if}

								<!-- Workload indicator -->
								{#if getWorkloadForService(service)}
									{@const workloadInfo = getWorkloadForService(service)}
									<div class="flex items-center gap-2">
										{#if !service.requested_date}
											<span class="text-sm text-muted-foreground">{m.workload_today()}:</span>
										{/if}
										<WorkloadSummary workload={workloadInfo!.workload} compact />
									</div>
								{/if}

								<!-- Notes -->
								{#if service.notes}
									<p class="text-sm text-muted-foreground">{service.notes}</p>
								{/if}

								<!-- Created date -->
								<p class="text-xs text-muted-foreground">
									{m.created_at({ date: formatDate(service.created_at) })}
								</p>
							</div>

							<!-- Actions -->
							<div class="flex flex-wrap gap-2">
								<Button size="sm" onclick={() => openAcceptDialog(service)}>
									{m.requests_accept()}
								</Button>
								<Button size="sm" variant="outline" onclick={() => openSuggestDialog(service)}>
									{m.requests_suggest()}
								</Button>
								<Button size="sm" variant="destructive" onclick={() => openRejectDialog(service)}>
									{m.requests_reject()}
								</Button>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	<!-- Pending Reschedules Section -->
	{#if data.pendingReschedules.length > 0}
		<Separator class="my-6" />

		<div class="space-y-4">
			<div>
				<h2 class="text-xl font-semibold">{m.courier_pending_reschedules()}</h2>
				<p class="text-muted-foreground text-sm">{m.courier_pending_reschedules_desc()}</p>
			</div>

			<div class="grid gap-4">
				{#each data.pendingReschedules as service}
					<Card.Root class="border-orange-200">
						<Card.Content class="pt-6">
							<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div class="space-y-3 flex-1">
									<div class="flex items-center gap-2">
										<a
											href={localizeHref(`/courier/clients/${service.profiles.id}`)}
											class="font-medium hover:underline"
										>
											{service.profiles.name}
										</a>
									</div>

									<div class="text-sm">
										<span class="text-muted-foreground">{m.reschedule_current()}</span>
										{formatRequestDate(service.scheduled_date)}
										{#if service.scheduled_time_slot}
											- {formatTimeSlot(service.scheduled_time_slot)}
										{/if}
									</div>

									<div class="text-sm font-medium text-orange-600">
										<span>{m.reschedule_new()}</span>
										{formatRequestDate(service.pending_reschedule_date)}
										{#if service.pending_reschedule_time_slot}
											- {formatTimeSlot(service.pending_reschedule_time_slot)}
										{/if}
									</div>

									{#if service.pending_reschedule_reason}
										<p class="text-sm text-muted-foreground italic">
											"{service.pending_reschedule_reason}"
										</p>
									{/if}
								</div>

								<div class="flex flex-wrap gap-2">
									<Button size="sm" onclick={() => handleApproveReschedule(service.id)}>
										{m.courier_approve_reschedule()}
									</Button>
									<Button size="sm" variant="destructive" onclick={() => openDenyRescheduleDialog(service)}>
										{m.courier_deny_reschedule()}
									</Button>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Accept Dialog -->
<Dialog.Root bind:open={showAcceptDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.requests_confirm_accept()}</Dialog.Title>
			<Dialog.Description>
				{m.requests_confirm_accept_desc()}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedService}
			<div class="space-y-2 text-sm">
				<p><strong>{selectedService.profiles.name}</strong></p>
				<p>{m.location_from()} {selectedService.pickup_location}</p>
				<p>{m.location_to()} {selectedService.delivery_location}</p>
				{#if selectedService.requested_date || selectedService.requested_time_slot}
					<p>
						{formatRequestDate(selectedService.requested_date)}
						{#if selectedService.requested_time_slot}
							- {formatTimeSlot(selectedService.requested_time_slot)}
						{/if}
					</p>
				{/if}
			</div>

			<!-- Workload for requested date -->
			{@const workloadInfo = getWorkloadForService(selectedService)}
			{#if workloadInfo}
				<div class="mt-4">
					<WorkloadSummary workload={workloadInfo.workload} dateLabel={workloadInfo.label} />
				</div>
			{/if}

			<!-- If no date requested, also show tomorrow -->
			{#if !selectedService.requested_date && data.workloadByDate[data.tomorrowStr]}
				<div class="mt-2">
					<WorkloadSummary
						workload={data.workloadByDate[data.tomorrowStr]}
						dateLabel={m.workload_tomorrow()}
					/>
				</div>
			{/if}

			<!-- Next compatible day suggestion if neither today nor tomorrow is comfortable -->
			{#if !selectedService.requested_date && data.nextCompatibleDay}
				{@const todayWorkload = data.workloadByDate[data.todayStr]}
				{@const tomorrowWorkload = data.workloadByDate[data.tomorrowStr]}
				{#if todayWorkload?.status !== 'comfortable' && tomorrowWorkload?.status !== 'comfortable'}
					<div class="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
						<div class="flex items-center gap-2 text-sm">
							<span class="text-blue-600">💡</span>
							<span class="text-blue-600 font-medium">
								{m.workload_next_compatible()}: {formatRequestDate(data.nextCompatibleDay.date)}
							</span>
						</div>
					</div>
				{/if}
			{/if}
		{/if}

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showAcceptDialog = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleAccept} disabled={loading}>
				{loading ? m.saving() : m.requests_accept()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Reject Dialog -->
<Dialog.Root bind:open={showRejectDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.requests_confirm_reject()}</Dialog.Title>
			<Dialog.Description>
				{m.requests_confirm_reject_desc()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="rejection-reason">{m.requests_rejection_reason()}</Label>
				<Input
					id="rejection-reason"
					type="text"
					placeholder={m.requests_rejection_placeholder()}
					bind:value={rejectionReason}
					disabled={loading}
				/>
			</div>
		</div>

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showRejectDialog = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleReject} disabled={loading}>
				{loading ? m.saving() : m.requests_reject()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Suggest Dialog -->
<Dialog.Root bind:open={showSuggestDialog}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.requests_suggest()}</Dialog.Title>
			<Dialog.Description>
				{m.requests_confirm_suggest_desc()}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedService?.requested_date || selectedService?.requested_time_slot}
			<div class="rounded-md bg-muted p-3 text-sm">
				<p class="font-medium">{m.requests_requested_schedule()}:</p>
				<p>
					{formatRequestDate(selectedService?.requested_date ?? null)}
					{#if selectedService?.requested_time_slot}
						- {formatTimeSlot(selectedService?.requested_time_slot ?? null)}
					{/if}
				</p>
			</div>
		{/if}

		<Separator />

		<div class="space-y-2">
			<p class="font-medium text-sm">{m.requests_suggested_date()}:</p>
			<SchedulePicker
				selectedDate={suggestedDate}
				selectedTimeSlot={suggestedTimeSlot}
				selectedTime={suggestedTime}
				onDateChange={(date) => (suggestedDate = date)}
				onTimeSlotChange={(slot) => (suggestedTimeSlot = slot)}
				onTimeChange={(time) => (suggestedTime = time)}
				disabled={loading}
			/>
		</div>

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showSuggestDialog = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleSuggest} disabled={loading || !suggestedDate || !suggestedTimeSlot || (suggestedTimeSlot === 'specific' && !suggestedTime)}>
				{loading ? m.saving() : m.requests_confirm_suggest()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Deny Reschedule Dialog -->
<Dialog.Root bind:open={showDenyRescheduleDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.courier_deny_reschedule()}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="denial-reason">{m.courier_deny_reason()}</Label>
				<Input
					id="denial-reason"
					type="text"
					placeholder={m.courier_deny_reason_placeholder()}
					bind:value={denialReason}
					disabled={loading}
				/>
			</div>
		</div>

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showDenyRescheduleDialog = false)} disabled={loading}>
				{m.action_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDenyReschedule} disabled={loading}>
				{loading ? m.saving() : m.courier_deny_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
