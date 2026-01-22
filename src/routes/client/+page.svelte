<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import type { Service } from '$lib/database.types.js';

	let { data }: { data: PageData } = $props();

	let services = $state<Service[]>([]);
	let loading = $state(true);
	let actionLoading = $state(false);
	let actionError = $state('');

	// Dialog state for suggestion response
	let showSuggestionDialog = $state(false);
	let selectedService = $state<Service | null>(null);

	async function loadServices() {
		loading = true;
		const { data: result } = await data.supabase
			.from('services')
			.select('*')
			.is('deleted_at', null)
			.order('created_at', { ascending: false });

		services = (result || []) as Service[];
		loading = false;
	}

	$effect(() => {
		loadServices();
	});

	// Filter services by type
	const suggestedServices = $derived(services.filter((s) => s.request_status === 'suggested'));
	const pendingCount = $derived(services.filter((s) => s.status === 'pending').length);
	const deliveredCount = $derived(services.filter((s) => s.status === 'delivered').length);

	function getStatusLabel(status: string): string {
		return status === 'pending' ? m.status_pending() : m.status_delivered();
	}

	function getRequestStatusLabel(requestStatus: string): string {
		switch (requestStatus) {
			case 'pending':
				return m.request_status_pending();
			case 'accepted':
				return m.request_status_accepted();
			case 'rejected':
				return m.request_status_rejected();
			case 'suggested':
				return m.request_status_suggested();
			default:
				return requestStatus;
		}
	}

	function getRequestStatusColor(requestStatus: string): string {
		switch (requestStatus) {
			case 'pending':
				return 'border-yellow-500 text-yellow-500';
			case 'accepted':
				return 'border-green-500 text-green-500';
			case 'rejected':
				return 'border-red-500 text-red-500';
			case 'suggested':
				return 'border-orange-500 text-orange-500';
			default:
				return '';
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString(getLocale());
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString(getLocale());
	}

	function formatTimeSlot(slot: string | null): string {
		if (!slot) return '';
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

	function openSuggestionDialog(service: Service) {
		selectedService = service;
		actionError = '';
		showSuggestionDialog = true;
	}

	async function handleAcceptSuggestion() {
		if (!selectedService) return;
		actionLoading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);

		try {
			const response = await fetch('?/acceptSuggestion', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await loadServices();
					showSuggestionDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to accept suggestion';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		actionLoading = false;
	}

	async function handleDeclineSuggestion() {
		if (!selectedService) return;
		actionLoading = true;
		actionError = '';

		const formData = new FormData();
		formData.set('service_id', selectedService.id);

		try {
			const response = await fetch('?/declineSuggestion', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await loadServices();
					showSuggestionDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to decline suggestion';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		actionLoading = false;
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">{m.client_my_services()}</h1>
		<Button onclick={() => goto(localizeHref('/client/new'))}>{m.client_new_request()}</Button>
	</div>

	<!-- Suggested Services Alert -->
	{#if suggestedServices.length > 0}
		<Card.Root class="border-orange-500 bg-orange-500/5">
			<Card.Header class="pb-3">
				<Card.Title class="text-orange-600 flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" x2="12" y1="8" y2="12" />
						<line x1="12" x2="12.01" y1="16" y2="16" />
					</svg>
					{m.client_suggestions_pending()}
				</Card.Title>
				<Card.Description>
					{m.client_suggestions_description()}
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each suggestedServices as service (service.id)}
					<div class="flex items-center justify-between gap-4 p-3 rounded-lg bg-background border">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium truncate">
								{service.pickup_location} → {service.delivery_location}
							</p>
							<p class="text-sm text-muted-foreground">
								{m.requests_suggested_date()}: {formatDate(service.suggested_date || '')}
								{#if service.suggested_time_slot}
									- {formatTimeSlot(service.suggested_time_slot)}
								{/if}
							</p>
						</div>
						<Button size="sm" onclick={() => openSuggestionDialog(service)}>
							{m.action_respond()}
						</Button>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

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
			{#each services as service (service.id)}
				<a href={localizeHref(`/client/services/${service.id}`)} class="block">
					<Card.Root class="transition-colors hover:bg-muted/50">
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
									<div class="flex items-center gap-2">
										{#if service.request_status && service.request_status !== 'accepted'}
											<Badge
												variant="outline"
												class={getRequestStatusColor(service.request_status)}
											>
												{getRequestStatusLabel(service.request_status)}
											</Badge>
										{/if}
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
									{service.pickup_location} → {service.delivery_location}
								</p>
								{#if service.notes}
									<p class="mt-1 text-sm text-muted-foreground truncate">{service.notes}</p>
								{/if}
								{#if service.scheduled_date}
									<p class="mt-1 text-xs text-muted-foreground">
										{m.requests_scheduled()}: {formatDate(service.scheduled_date)}
										{#if service.scheduled_time_slot}
											- {formatTimeSlot(service.scheduled_time_slot)}
										{/if}
									</p>
								{/if}
								{#if service.delivered_at}
									<p class="mt-1 text-xs text-muted-foreground">
										{m.client_delivered_at({ datetime: formatDateTime(service.delivered_at) })}
									</p>
								{/if}
							</div>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		{/if}
	</div>
</div>

<!-- Suggestion Response Dialog -->
<Dialog.Root bind:open={showSuggestionDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.client_respond_to_suggestion()}</Dialog.Title>
			<Dialog.Description>
				{m.client_suggestion_response_desc()}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedService}
			<div class="space-y-4">
				<div class="rounded-lg bg-muted p-4 space-y-2">
					<p class="text-sm">
						<span class="font-medium">{m.form_pickup_location()}:</span>
						{selectedService.pickup_location}
					</p>
					<p class="text-sm">
						<span class="font-medium">{m.form_delivery_location()}:</span>
						{selectedService.delivery_location}
					</p>
				</div>

				{#if selectedService.requested_date || selectedService.requested_time_slot}
					<div class="text-sm">
						<p class="text-muted-foreground">{m.client_your_request()}:</p>
						<p>
							{formatDate(selectedService.requested_date || '')}
							{#if selectedService.requested_time_slot}
								- {formatTimeSlot(selectedService.requested_time_slot)}
							{/if}
						</p>
					</div>
				{/if}

				<div class="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
					<p class="text-sm font-medium text-orange-600">{m.client_courier_suggests()}:</p>
					<p class="text-lg font-semibold">
						{formatDate(selectedService.suggested_date || '')}
						{#if selectedService.suggested_time_slot}
							- {formatTimeSlot(selectedService.suggested_time_slot)}
						{/if}
					</p>
				</div>
			</div>
		{/if}

		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}

		<Dialog.Footer class="flex-col sm:flex-row gap-2">
			<Button variant="outline" onclick={() => (showSuggestionDialog = false)} disabled={actionLoading}>
				{m.action_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDeclineSuggestion} disabled={actionLoading}>
				{actionLoading ? m.saving() : m.action_decline()}
			</Button>
			<Button onclick={handleAcceptSuggestion} disabled={actionLoading}>
				{actionLoading ? m.saving() : m.action_accept()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
