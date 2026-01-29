<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ServiceLocationCard from '$lib/components/ServiceLocationCard.svelte';
	import StatusHistory from '$lib/components/StatusHistory.svelte';
	import UrgencyBadge from '$lib/components/UrgencyBadge.svelte';
	import { settingsToConfig } from '$lib/utils/past-due.js';
	import { getRequestStatusLabel, getRequestStatusColor } from '$lib/utils/status.js';
import { formatDate, formatDateTime, formatTimeSlot } from '$lib/utils.js';
	import RescheduleDialog from '$lib/components/RescheduleDialog.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { TimeSlot } from '$lib/database.types.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData } from './$types';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import {
		ArrowLeft,
		Edit,
		Trash2,
		MoreVertical,
		Clock,
		User,
		CheckCircle,
		Circle,
		Euro,
		CalendarClock
	} from '@lucide/svelte';

	const hasMapbox = !!PUBLIC_MAPBOX_TOKEN;

	let { data }: { data: PageData } = $props();

	// Access layout profile data for past due config
	const pastDueConfig = $derived(settingsToConfig(data.profile?.past_due_settings, data.profile?.time_slots));

	let showDeleteDialog = $state(false);
	let showStatusDialog = $state(false);
	let showPriceOverride = $state(false);
	let showRescheduleDialog = $state(false);
	let pendingStatus = $state<'pending' | 'delivered'>('pending');
	let loading = $state(false);
	let actionError = $state('');
	let priceOverrideLoading = $state(false);
	let priceOverrideError = $state('');


	async function handleStatusChange() {
		loading = true;
		actionError = '';
		const formData = new FormData();
		formData.set('status', pendingStatus);

		try {
			const response = await fetch(`?/updateStatus`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await invalidateAll();
					showStatusDialog = false;
				} else {
					actionError = result.data?.error || 'Failed to update status';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	async function handleDelete() {
		loading = true;
		actionError = '';

		try {
			const response = await fetch(`?/deleteService`, {
				method: 'POST'
			});

			if (response.redirected) {
				await goto(response.url);
				return;
			}

			if (response.ok) {
				const result = await response.json();
				if (result.type === 'success' || result.data?.success) {
					await goto(localizeHref('/courier/services'));
				} else {
					actionError = result.data?.error || 'Failed to delete service';
				}
			} else {
				actionError = 'An unexpected error occurred';
			}
		} catch {
			actionError = 'An unexpected error occurred';
		}
		loading = false;
	}

	async function handleReschedule(data: {
		date: string;
		timeSlot: TimeSlot;
		time: string | null;
		reason: string;
		requestApproval: boolean;
	}) {
		const formData = new FormData();
		formData.set('date', data.date);
		formData.set('time_slot', data.timeSlot);
		if (data.time) formData.set('time', data.time);
		formData.set('reason', data.reason);
		if (data.requestApproval) formData.set('request_approval', '1');

		const response = await fetch('?/reschedule', {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			throw new Error('Failed to reschedule');
		}

		const result = await response.json();
		if (result.type === 'failure' || result.data?.success === false) {
			throw new Error(result.data?.error || 'Failed to reschedule');
		}

		await invalidateAll();
	}

	function confirmStatusChange(status: 'pending' | 'delivered') {
		pendingStatus = status;
		showStatusDialog = true;
	}

	function handlePriceOverrideSubmit() {
		priceOverrideLoading = true;
		priceOverrideError = '';
		return async ({ result }: { result: { type: string; data?: { error?: string; success?: boolean } } }) => {
			if (result.type === 'failure' && result.data?.error) {
				priceOverrideError = result.data.error;
			} else if (result.type === 'success' && result.data?.success) {
				showPriceOverride = false;
				await invalidateAll();
			}
			priceOverrideLoading = false;
		};
	}

	const service = $derived(data.service);
	const client = $derived(data.service.profiles);
	const statusHistory = $derived(data.statusHistory);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<Button variant="ghost" size="sm" href={localizeHref('/courier/services')}>
				<ArrowLeft class="size-4" />
			</Button>
			<h1 class="text-2xl font-bold">{m.service_details()}</h1>
		</div>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="outline" size="sm" {...props}>
						<MoreVertical class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => goto(localizeHref(`/courier/services/${service.id}/edit`))}>
					<Edit class="mr-2 size-4" />
					{m.action_edit()}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					class="text-destructive focus:text-destructive"
					onclick={() => (showDeleteDialog = true)}
				>
					<Trash2 class="mr-2 size-4" />
					{m.action_delete()}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Status Badge & Quick Actions -->
	<Card.Root>
		<Card.Content class="space-y-3 p-4">
			<div class="flex flex-wrap items-center gap-2">
				<Badge
					variant={service.status === 'pending' ? 'default' : 'secondary'}
					class={service.status === 'pending'
						? 'bg-blue-500 hover:bg-blue-500/80'
						: 'bg-green-500 hover:bg-green-500/80 text-white'}
				>
					{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
				</Badge>
				<UrgencyBadge {service} config={pastDueConfig} />
				<span class="text-sm text-muted-foreground">
					{m.created_at({ date: formatDate(service.created_at) })}
				</span>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if service.status === 'pending'}
					{#if !service.pending_reschedule_date}
						<Button variant="outline" size="sm" onclick={() => (showRescheduleDialog = true)}>
							<CalendarClock class="mr-2 size-4" />
							{m.reschedule()}
						</Button>
					{/if}
					<Button size="sm" onclick={() => confirmStatusChange('delivered')}>
						<CheckCircle class="mr-2 size-4" />
						{m.mark_delivered()}
					</Button>
				{:else}
					<Button variant="outline" size="sm" onclick={() => confirmStatusChange('pending')}>
						<Circle class="mr-2 size-4" />
						{m.mark_pending()}
					</Button>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	{#if service.scheduled_date || service.requested_date}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<CalendarClock class="size-5" />
					{m.schedule_title()}
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if service.requested_date}
					<div>
						<p class="text-sm text-muted-foreground">{m.requests_requested_schedule()}</p>
						<p>
							{formatDate(service.requested_date)}
							{#if service.requested_time_slot}
								— {formatTimeSlot(service.requested_time_slot)}
							{/if}
						</p>
					</div>
				{/if}
				{#if service.scheduled_date}
					<div>
						<p class="text-sm text-muted-foreground">{m.schedule_date()}</p>
						<p>{formatDate(service.scheduled_date)}</p>
					</div>
					{#if service.scheduled_time_slot}
						<div>
							<p class="text-sm text-muted-foreground">{m.schedule_time_slot()}</p>
							<p>
								{#if service.scheduled_time_slot === 'specific' && service.scheduled_time}
									{service.scheduled_time}
								{:else}
									{formatTimeSlot(service.scheduled_time_slot)}
								{/if}
							</p>
						</div>
					{/if}
				{/if}
				{#if service.request_status && service.request_status !== 'accepted'}
					<div>
						<p class="text-sm text-muted-foreground">{m.request_status_label()}</p>
						<Badge variant="outline" class={getRequestStatusColor(service.request_status)}>
							{getRequestStatusLabel(service.request_status)}
						</Badge>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	<Tabs.Root value="details">
		<Tabs.List>
			<Tabs.Trigger value="details">{m.tab_details()}</Tabs.Trigger>
			<Tabs.Trigger value="history">{m.tab_history()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="details" class="space-y-4 pt-4">
			<!-- Locations (first for field use) -->
			<ServiceLocationCard {service} {hasMapbox} />

			<!-- Notes -->
			{#if service.notes}
				<Card.Root>
					<Card.Header>
						<Card.Title>{m.form_notes()}</Card.Title>
					</Card.Header>
					<Card.Content>
						<p class="whitespace-pre-wrap">{service.notes}</p>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Client Info -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<User class="size-5" />
						{m.client_info()}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-2">
						<p class="font-medium">{client.name}</p>
						{#if client.phone}
							<p class="text-sm text-muted-foreground">{client.phone}</p>
						{/if}
						<Button
							variant="link"
							class="h-auto p-0 text-sm"
							href={localizeHref(`/courier/clients/${client.id}`)}
						>
							{m.view_client_profile()}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Price -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Euro class="size-5" />
						{m.billing_price()}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if service.calculated_price !== null}
						<div class="flex items-center justify-between">
							<div>
								<p class="text-2xl font-bold">€{service.calculated_price.toFixed(2)}</p>
								{#if service.price_override_reason}
									<p class="text-sm text-muted-foreground">{service.price_override_reason}</p>
								{/if}
							</div>
							<Button variant="outline" onclick={() => (showPriceOverride = true)}>
								{m.price_override()}
							</Button>
						</div>
					{:else}
						<div class="flex items-center justify-between">
							<p class="text-muted-foreground">{m.price_pending()}</p>
							<Button variant="outline" onclick={() => (showPriceOverride = true)}>
								{m.price_override()}
							</Button>
						</div>
					{/if}

					<!-- Type-based pricing breakdown -->
					{#if service.service_type_id || service.is_out_of_zone !== null || service.tolls}
						<Separator class="my-4" />
						<div class="space-y-2 text-sm">
							{#if service.service_types?.name}
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.service_type()}</span>
									<span class="font-medium">{service.service_types.name}</span>
								</div>
							{/if}
							{#if service.is_out_of_zone !== null}
								<div class="flex items-center justify-between">
									<span class="text-muted-foreground">{m.zone_status()}</span>
									{#if !service.is_out_of_zone}
										<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
											{m.in_zone()}
										</Badge>
									{:else}
										<Badge variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
											{m.out_of_zone()}
										</Badge>
									{/if}
								</div>
							{/if}
							{#if service.has_time_preference}
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.time_preference_label()}</span>
									<span>{m.yes()}</span>
								</div>
							{/if}
							{#if service.tolls && service.tolls > 0}
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.tolls_label()}</span>
									<span>€{Number(service.tolls).toFixed(2)}</span>
								</div>
							{/if}
							{#if service.distance_km && service.is_out_of_zone}
								<div class="flex justify-between">
									<span class="text-muted-foreground">{m.distance_label()}</span>
									<span>{service.distance_km.toFixed(1)} km</span>
								</div>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="history" class="pt-4 space-y-4">
			<!-- Service Lifecycle -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Clock class="size-5" />
						{m.service_lifecycle()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_created()}</span>
						<span>{formatDateTime(service.created_at)}</span>
					</div>
					{#if service.updated_at}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.label_updated()}</span>
							<span>{formatDateTime(service.updated_at)}</span>
						</div>
					{/if}
					{#if service.delivered_at}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.label_delivered()}</span>
							<span>{formatDateTime(service.delivered_at)}</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- Status History -->
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.status_history()}</Card.Title>
				</Card.Header>
				<Card.Content>
					<StatusHistory {statusHistory} />
				</Card.Content>
			</Card.Root>
		</Tabs.Content>
	</Tabs.Root>
</div>

<!-- Status Change Dialog -->
<AlertDialog.Root bind:open={showStatusDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.confirm_status_change()}</AlertDialog.Title>
			<AlertDialog.Description>
				{#if pendingStatus === 'delivered'}
					{m.confirm_mark_delivered()}
				{:else}
					{m.confirm_mark_pending()}
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading} onclick={() => (actionError = '')}>{m.action_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleStatusChange} disabled={loading}>
				{loading ? m.loading() : m.action_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.confirm_delete_service()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.confirm_delete_service_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		{#if actionError}
			<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{actionError}
			</div>
		{/if}
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={loading} onclick={() => (actionError = '')}>{m.action_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={handleDelete}
				disabled={loading}
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
			>
				{loading ? m.loading() : m.action_delete()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Price Override Dialog -->
<AlertDialog.Root bind:open={showPriceOverride}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.price_override()}</AlertDialog.Title>
		</AlertDialog.Header>
		<form method="POST" action="?/overridePrice" use:enhance={handlePriceOverrideSubmit}>
			<div class="space-y-4 py-4">
				{#if service.calculated_price !== null}
					<p class="text-sm text-muted-foreground">
						{m.price_calculated()}: €{service.calculated_price.toFixed(2)}
					</p>
				{/if}
				{#if priceOverrideError}
					<div class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{priceOverrideError}
					</div>
				{/if}
				<div class="space-y-2">
					<Label for="override_price">{m.price_override()}</Label>
					<Input
						id="override_price"
						name="override_price"
						type="number"
						step="0.01"
						min="0"
						value={service.calculated_price ?? ''}
						required
					/>
				</div>
				<div class="space-y-2">
					<Label for="override_reason">{m.price_override_reason()}</Label>
					<Input
						id="override_reason"
						name="override_reason"
						value={service.price_override_reason ?? ''}
					/>
				</div>
			</div>
			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => (priceOverrideError = '')}>{m.action_cancel()}</AlertDialog.Cancel>
				<Button type="submit" disabled={priceOverrideLoading}>
					{priceOverrideLoading ? m.saving() : m.price_save_override()}
				</Button>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Reschedule Dialog -->
<RescheduleDialog
	{service}
	bind:open={showRescheduleDialog}
	onReschedule={handleReschedule}
/>
