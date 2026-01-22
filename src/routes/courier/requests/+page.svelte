<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
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

	// Form states for dialogs
	let rejectionReason = $state('');
	let suggestedDate = $state<string | null>(null);
	let suggestedTimeSlot = $state<TimeSlot | null>(null);
	let suggestedTime = $state<string | null>(null);

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('pt-PT', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
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
		loading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);
		formData.set('suggested_date', suggestedDate);
		formData.set('suggested_time_slot', suggestedTimeSlot);

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
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">{m.requests_title()}</h1>
			<p class="text-muted-foreground">
				{data.pendingRequests.length} {data.pendingRequests.length === 1 ? 'pedido' : 'pedidos'}
			</p>
		</div>
	</div>

	{#if data.pendingRequests.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">{m.requests_no_pending()}</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4">
			{#each data.pendingRequests as service}
				<Card.Root>
					<Card.Content class="pt-6">
						<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
										<span class="text-blue-500 font-medium">De:</span>
										<span>{service.pickup_location}</span>
									</div>
									<div class="flex items-start gap-2">
										<span class="text-green-500 font-medium">Para:</span>
										<span>{service.delivery_location}</span>
									</div>
								</div>

								<!-- Requested schedule -->
								{#if service.requested_date || service.requested_time_slot}
									<div class="flex items-center gap-2">
										<Badge variant="outline">{m.requests_requested_schedule()}</Badge>
										<span class="text-sm">
											{formatDate(service.requested_date)}
											{#if service.requested_time_slot}
												- {formatTimeSlot(service.requested_time_slot)}
											{/if}
											{#if service.requested_time}
												({service.requested_time})
											{/if}
										</span>
									</div>
								{/if}

								<!-- Notes -->
								{#if service.notes}
									<p class="text-sm text-muted-foreground">{service.notes}</p>
								{/if}

								<!-- Created date -->
								<p class="text-xs text-muted-foreground">
									{m.created_at({ date: new Date(service.created_at).toLocaleDateString('pt-PT') })}
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
				<p>De: {selectedService.pickup_location}</p>
				<p>Para: {selectedService.delivery_location}</p>
				{#if selectedService.requested_date || selectedService.requested_time_slot}
					<p>
						{formatDate(selectedService.requested_date)}
						{#if selectedService.requested_time_slot}
							- {formatTimeSlot(selectedService.requested_time_slot)}
						{/if}
					</p>
				{/if}
			</div>
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
					{formatDate(selectedService?.requested_date ?? null)}
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
			<Button onclick={handleSuggest} disabled={loading || !suggestedDate || !suggestedTimeSlot}>
				{loading ? m.saving() : m.requests_confirm_suggest()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
