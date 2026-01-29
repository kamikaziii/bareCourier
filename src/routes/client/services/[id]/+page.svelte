<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import ServiceLocationCard from '$lib/components/ServiceLocationCard.svelte';
	import StatusHistory from '$lib/components/StatusHistory.svelte';
	import SchedulePicker from '$lib/components/SchedulePicker.svelte';
	import { invalidateAll } from '$app/navigation';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
import { formatDate, formatDateTime, formatTimeSlot } from '$lib/utils.js';
	import type { PageData } from './$types';
	import type { TimeSlot } from '$lib/database.types.js';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import { ArrowLeft, Clock, Calendar, CalendarClock, AlertCircle, Euro, Printer, Copy, UserCheck } from '@lucide/svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import ServiceLabel from '$lib/components/ServiceLabel.svelte';

	const hasMapbox = !!PUBLIC_MAPBOX_TOKEN;

	let { data }: { data: PageData } = $props();

	const service = $derived(data.service);
	const statusHistory = $derived(data.statusHistory);

	// Reschedule dialog state
	let showRescheduleDialog = $state(false);
	let rescheduleDate = $state<string | null>(null);
	let rescheduleTimeSlot = $state<TimeSlot | null>(null);
	let rescheduleTime = $state<string | null>(null);
	let rescheduleReason = $state('');
	let rescheduleLoading = $state(false);
	let rescheduleError = $state('');
	let rescheduleSuccess = $state<'auto_approved' | 'pending' | null>(null);
	let rescheduleActionLoading = $state(false);
	let showDeclineDialog = $state(false);
	let declineReason = $state('');
	let showPrintDialog = $state(false);
	let idCopied = $state(false);

	function handlePrint() {
		window.print();
	}

	async function copyDisplayId() {
		if (service.display_id) {
			await navigator.clipboard.writeText(service.display_id);
			idCopied = true;
			setTimeout(() => (idCopied = false), 2000);
		}
	}

	// Reschedule availability checks
	const canReschedule = $derived.by(() => {
		if (service.status !== 'pending') return { allowed: false, reason: 'not_pending' };
		if (!data.rescheduleSettings.allowed) return { allowed: false, reason: 'disabled' };
		if ((service.reschedule_count || 0) >= data.rescheduleSettings.maxReschedules) {
			return { allowed: false, reason: 'max_reached' };
		}
		if (service.pending_reschedule_date) return { allowed: false, reason: 'pending_request' };
		return { allowed: true, reason: null };
	});

	function openRescheduleDialog() {
		rescheduleDate = service.scheduled_date;
		rescheduleTimeSlot = service.scheduled_time_slot as TimeSlot | null;
		rescheduleTime = service.scheduled_time;
		rescheduleReason = '';
		rescheduleError = '';
		showRescheduleDialog = true;
	}

	async function handleReschedule() {
		if (!rescheduleDate || !rescheduleTimeSlot) return;
		if (rescheduleTimeSlot === 'specific' && !rescheduleTime) return;

		rescheduleLoading = true;
		rescheduleError = '';

		const formData = new FormData();
		formData.set('date', rescheduleDate);
		formData.set('time_slot', rescheduleTimeSlot);
		if (rescheduleTime) formData.set('time', rescheduleTime);
		formData.set('reason', rescheduleReason);

		try {
			const response = await fetch('?/requestReschedule', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			if (result.data?.success) {
				await invalidateAll();
				showRescheduleDialog = false;
				// Show success feedback
				rescheduleSuccess = result.data.needsApproval ? 'pending' : 'auto_approved';
				// Auto-hide after 5 seconds
				setTimeout(() => {
					rescheduleSuccess = null;
				}, 5000);
			} else {
				rescheduleError = result.data?.error || 'Failed to request reschedule';
			}
		} catch {
			rescheduleError = 'An unexpected error occurred';
		}

		rescheduleLoading = false;
	}

	async function handleAcceptReschedule() {
		rescheduleActionLoading = true;
		try {
			const response = await fetch('?/acceptReschedule', { method: 'POST' });
			const result = await response.json();
			if (result.data?.success) {
				await invalidateAll();
			}
		} catch { /* ignore */ }
		rescheduleActionLoading = false;
	}

	async function handleDeclineReschedule() {
		rescheduleActionLoading = true;
		const formData = new FormData();
		if (declineReason) formData.set('reason', declineReason);
		try {
			const response = await fetch('?/declineReschedule', { method: 'POST', body: formData });
			const result = await response.json();
			if (result.data?.success) {
				showDeclineDialog = false;
				declineReason = '';
				await invalidateAll();
			}
		} catch { /* ignore */ }
		rescheduleActionLoading = false;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref('/client')}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold flex-1">{m.service_details()}</h1>
		<div class="flex gap-2">
			{#if service.display_id && data.courierProfile}
				<Button variant="outline" size="sm" onclick={() => (showPrintDialog = true)}>
					<Printer class="size-4 mr-2" />
					{m.print_label()}
				</Button>
			{/if}
			{#if service.request_status === 'pending'}
				<Button variant="outline" size="sm" href={localizeHref(`/client/services/${service.id}/edit`)}>
					{m.action_edit()}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Reschedule Success Banner -->
	{#if rescheduleSuccess}
		<Card.Root class={rescheduleSuccess === 'auto_approved' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
			<Card.Content class="flex items-center gap-3 p-4">
				<div class={rescheduleSuccess === 'auto_approved' ? 'text-green-600' : 'text-blue-600'}>
					{#if rescheduleSuccess === 'auto_approved'}
						<p class="font-medium">{m.client_reschedule_auto_approved()}</p>
					{:else}
						<p class="font-medium">{m.client_reschedule_success()}</p>
						<p class="text-sm mt-1">{m.client_reschedule_pending_desc()}</p>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Status Badge & Service Info -->
	<Card.Root>
		<Card.Content class="space-y-3 p-4">
			<!-- Display ID with copy button -->
			<div class="flex items-center gap-2">
				<span class="font-mono text-lg font-semibold">{service.display_id}</span>
				<Button variant="ghost" size="sm" onclick={copyDisplayId} class="h-7 px-2">
					<Copy class="size-4" />
				</Button>
				{#if idCopied}
					<span class="text-xs text-green-600">{m.service_id_copied()}</span>
				{/if}
			</div>
			{#if service.customer_reference}
				<p class="text-sm text-muted-foreground">
					{m.customer_reference()}: {service.customer_reference}
				</p>
			{/if}

			<div class="flex items-center gap-3">
				<Badge
					variant={service.status === 'pending' ? 'default' : 'secondary'}
					class={service.status === 'pending'
						? 'bg-blue-500 hover:bg-blue-500/80'
						: 'bg-green-500 hover:bg-green-500/80 text-white'}
				>
					{service.status === 'pending' ? m.status_pending() : m.status_delivered()}
				</Badge>
				<span class="text-sm text-muted-foreground">
					{m.created_at({ date: formatDate(service.created_at) })}
				</span>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Reschedule Section -->
	{#if service.status === 'pending'}
		<!-- Pending Reschedule Banner -->
		{#if service.pending_reschedule_date}
			{#if service.pending_reschedule_requested_by !== data.session?.user?.id}
				<!-- Courier-initiated: show accept/decline buttons -->
				<Card.Root class="border-orange-200 bg-orange-50">
					<Card.Content class="p-4 space-y-3">
						<div class="flex items-start gap-3">
							<AlertCircle class="size-5 text-orange-600 mt-0.5" />
							<div class="flex-1">
								<p class="font-medium text-orange-800">{m.client_reschedule_courier_proposes()}</p>
								<p class="text-sm text-orange-600 mt-2">
									{formatDate(service.pending_reschedule_date)}
									{#if service.pending_reschedule_time_slot}
										- {service.pending_reschedule_time_slot === 'specific' && service.pending_reschedule_time
											? service.pending_reschedule_time
											: formatTimeSlot(service.pending_reschedule_time_slot)}
									{/if}
								</p>
								{#if service.pending_reschedule_reason}
									<p class="text-sm text-muted-foreground mt-1">{service.pending_reschedule_reason}</p>
								{/if}
							</div>
						</div>
						<div class="flex gap-2">
							<Button size="sm" onclick={handleAcceptReschedule} disabled={rescheduleActionLoading}>
								{m.client_accept_reschedule()}
							</Button>
							<Button variant="outline" size="sm" onclick={() => (showDeclineDialog = true)} disabled={rescheduleActionLoading}>
								{m.client_decline_reschedule()}
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{:else}
				<!-- Client-initiated: read-only banner -->
				<Card.Root class="border-orange-200 bg-orange-50">
					<Card.Content class="flex items-start gap-3 p-4">
						<AlertCircle class="size-5 text-orange-600 mt-0.5" />
						<div>
							<p class="font-medium text-orange-800">{m.client_reschedule_pending()}</p>
							<p class="text-sm text-orange-700 mt-1">{m.client_reschedule_pending_desc()}</p>
							<p class="text-sm text-orange-600 mt-2">
								{formatDate(service.pending_reschedule_date)}
								{#if service.pending_reschedule_time_slot}
									- {formatTimeSlot(service.pending_reschedule_time_slot)}
								{/if}
							</p>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
		{:else}
			<!-- Reschedule Button -->
			{#if canReschedule.allowed}
				<Button variant="outline" class="w-full" onclick={openRescheduleDialog}>
					<CalendarClock class="size-4 mr-2" />
					{m.client_request_reschedule()}
				</Button>
			{:else if canReschedule.reason === 'max_reached'}
				<div class="text-sm text-muted-foreground text-center p-2">
					{m.client_reschedule_max_reached()}
				</div>
			{:else if canReschedule.reason === 'disabled'}
				<div class="text-sm text-muted-foreground text-center p-2">
					{m.client_reschedule_disabled()}
				</div>
			{/if}
		{/if}
	{/if}

	<Tabs.Root value="details">
		<Tabs.List>
			<Tabs.Trigger value="details">{m.tab_details()}</Tabs.Trigger>
			<Tabs.Trigger value="history">{m.tab_history()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="details" class="space-y-4 pt-4">
			<!-- Locations -->
			<ServiceLocationCard {service} {hasMapbox} />

			<!-- Recipient Info (conditional) -->
			{#if service.recipient_name || service.recipient_phone}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<UserCheck class="size-5" />
							{m.recipient()}
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-1">
						{#if service.recipient_name}
							<p class="font-medium">{service.recipient_name}</p>
						{/if}
						{#if service.recipient_phone}
							<a href="tel:{service.recipient_phone}" class="text-sm text-primary hover:underline">
								{service.recipient_phone}
							</a>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Scheduling Info -->
			{#if service.requested_date || service.scheduled_date}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Calendar class="size-5" />
							{m.scheduling_info()}
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#if service.requested_date}
							<div>
								<p class="text-sm font-medium text-muted-foreground">{m.client_your_request()}</p>
								<p class="mt-1">
									{formatDate(service.requested_date)}
									{#if service.requested_time_slot}
										- {formatTimeSlot(service.requested_time_slot)}
									{/if}
								</p>
							</div>
						{/if}

						{#if service.scheduled_date}
							<Separator />
							<div>
								<p class="text-sm font-medium text-muted-foreground">{m.requests_scheduled()}</p>
								<p class="mt-1 font-medium text-green-600">
									{formatDate(service.scheduled_date)}
									{#if service.scheduled_time_slot}
										- {formatTimeSlot(service.scheduled_time_slot)}
									{/if}
								</p>
							</div>
						{/if}

						{#if service.request_status === 'suggested' && service.suggested_date}
							<Separator />
							<div class="rounded-lg bg-orange-500/10 p-3">
								<p class="text-sm font-medium text-orange-600">{m.client_courier_suggests()}</p>
								<p class="mt-1">
									{formatDate(service.suggested_date)}
									{#if service.suggested_time_slot}
										- {formatTimeSlot(service.suggested_time_slot)}
									{/if}
								</p>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Pricing Info (for type-based pricing) -->
			{#if data.showPriceToClient && (service.service_types || service.calculated_price !== null)}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<Euro class="size-5" />
							{m.pricing_info()}
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2">
						{#if service.service_types?.name}
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.service_type()}</span>
								<span class="font-medium">{service.service_types.name}</span>
							</div>
						{/if}
						{#if service.is_out_of_zone !== null}
							<div class="flex justify-between">
								<span class="text-muted-foreground">{m.zone_status()}</span>
								<Badge variant="secondary" class={service.is_out_of_zone
									? 'bg-amber-100 text-amber-800'
									: 'bg-green-100 text-green-800'}>
									{service.is_out_of_zone ? m.out_of_zone() : m.in_zone()}
								</Badge>
							</div>
						{/if}
						{#if service.calculated_price !== null}
							<Separator />
							<div class="flex justify-between font-medium">
								<span>{m.total_price()}</span>
								<span class="text-lg">€{service.calculated_price.toFixed(2)}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

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

			<!-- Timestamps -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Clock class="size-5" />
						{m.timestamps()}
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.label_created()}</span>
						<span>{formatDateTime(service.created_at)}</span>
					</div>
					{#if service.delivered_at}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.label_delivered()}</span>
							<span>{formatDateTime(service.delivered_at)}</span>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="history" class="pt-4">
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

<!-- Reschedule Dialog -->
<Dialog.Root bind:open={showRescheduleDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<CalendarClock class="size-5" />
				{m.client_request_reschedule()}
			</Dialog.Title>
			<Dialog.Description>{m.client_request_reschedule_desc()}</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if rescheduleError}
				<div role="alert" class="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{rescheduleError}
				</div>
			{/if}

			<SchedulePicker
				selectedDate={rescheduleDate}
				selectedTimeSlot={rescheduleTimeSlot}
				selectedTime={rescheduleTime}
				onDateChange={(date) => (rescheduleDate = date)}
				onTimeSlotChange={(slot) => (rescheduleTimeSlot = slot)}
				onTimeChange={(time) => (rescheduleTime = time)}
			/>

			<div class="space-y-2">
				<Label for="reschedule-reason">{m.client_reschedule_reason()}</Label>
				<Textarea
					id="reschedule-reason"
					bind:value={rescheduleReason}
					placeholder={m.client_reschedule_reason_placeholder()}
					rows={2}
				/>
			</div>

			<p class="text-xs text-muted-foreground">
				{m.client_reschedule_too_late({ hours: data.rescheduleSettings.minNoticeHours })}
			</p>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showRescheduleDialog = false)} disabled={rescheduleLoading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleReschedule} disabled={!rescheduleDate || !rescheduleTimeSlot || (rescheduleTimeSlot === 'specific' && !rescheduleTime) || rescheduleLoading}>
				{rescheduleLoading ? m.saving() : m.client_request_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Decline Reschedule Dialog -->
<Dialog.Root bind:open={showDeclineDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m.client_decline_reschedule()}</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="decline-reason">{m.courier_deny_reason()}</Label>
				<Textarea
					id="decline-reason"
					bind:value={declineReason}
					placeholder={m.courier_deny_reason_placeholder()}
					rows={2}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (showDeclineDialog = false)} disabled={rescheduleActionLoading}>
				{m.action_cancel()}
			</Button>
			<Button onclick={handleDeclineReschedule} disabled={rescheduleActionLoading}>
				{rescheduleActionLoading ? m.saving() : m.client_decline_reschedule()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Print Label Dialog -->
{#if data.courierProfile}
	<AlertDialog.Root bind:open={showPrintDialog}>
		<AlertDialog.Content class="max-w-lg print:max-w-none print:p-0 print:border-none print:shadow-none">
			<AlertDialog.Header class="print:hidden">
				<AlertDialog.Title>{m.print_label()}</AlertDialog.Title>
			</AlertDialog.Header>

			<div class="flex justify-center py-4 print:py-0">
				<ServiceLabel
					{service}
					courierProfile={data.courierProfile}
					clientName={data.profile?.name || ''}
				/>
			</div>

			<AlertDialog.Footer class="print:hidden">
				<AlertDialog.Cancel>{m.action_cancel()}</AlertDialog.Cancel>
				<Button onclick={handlePrint}>
					<Printer class="mr-2 size-4" />
					{m.print()}
				</Button>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{/if}
