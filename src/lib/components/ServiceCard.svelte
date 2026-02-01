<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { getStatusLabel, getRequestStatusLabel, getRequestStatusColor } from '$lib/utils/status.js';
	import * as m from '$lib/paraglide/messages.js';
	import { formatDate, formatDateTime, formatTimeSlot } from '$lib/utils.js';
	import { CalendarClock } from '@lucide/svelte';
	import { preloadData } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import type { Service } from '$lib/database.types.js';

	interface ServiceCardProps {
		/** The service object to render */
		service: Service & { profiles?: { name: string } | null };
		/** Show client name as the title line (courier views). If false, shows route as title (client view). */
		showClientName?: boolean;
		/** Enable batch selection checkbox */
		selectable?: boolean;
		/** Whether this card is currently selected */
		selected?: boolean;
		/** Callback when selection checkbox is toggled */
		onToggle?: () => void;
		/** Callback when the card is clicked */
		onClick?: () => void;
		/** URL for preloading on hover (improves navigation speed) */
		href?: string;
		/** Show request status badge (client view) */
		showRequestStatus?: boolean;
		/** Show delivered_at timestamp instead of created_at when delivered (client view) */
		showDeliveredAt?: boolean;
		/** Optional snippet rendered after status badge in the header row */
		headerActions?: Snippet;
		/** Optional snippet rendered after the request status row */
		extraContent?: Snippet;
		/** Optional snippet for urgency badge (courier views with PastDueConfig) */
		urgencyBadge?: Snippet;
	}

	let {
		service,
		showClientName = true,
		selectable = false,
		selected = false,
		onToggle,
		onClick,
		href,
		showRequestStatus = false,
		showDeliveredAt = false,
		headerActions,
		extraContent,
		urgencyBadge
	}: ServiceCardProps = $props();

	function handleMouseEnter() {
		if (href) {
			preloadData(href);
		}
	}

	const isSelected = $derived(selectable && selected);

	const statusTooltip = $derived(
		service.status === 'pending' ? m.status_pending_tooltip() : m.status_delivered_tooltip()
	);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="block w-full text-left cursor-pointer"
	onmouseenter={handleMouseEnter}
	onclick={() => {
		if (selectable && service.status === 'pending' && onToggle) {
			onToggle();
		} else if (onClick) {
			onClick();
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (selectable && service.status === 'pending' && onToggle) {
				onToggle();
			} else if (onClick) {
				onClick();
			}
		}
	}}
	role="button"
	tabindex="0"
>
	<Card.Root class="overflow-hidden transition-colors hover:bg-muted/50 {isSelected ? 'ring-2 ring-primary' : ''}">
		<Card.Content class="flex items-start gap-3 p-4">
			{#if selectable && service.status === 'pending'}
				<Checkbox
					checked={selected}
					onCheckedChange={() => onToggle?.()}
					class="mt-1"
				/>
			{:else}
				<div
					class="mt-1.5 size-3 shrink-0 rounded-full {service.status === 'pending'
						? 'bg-blue-500'
						: 'bg-green-500'}"
				></div>
			{/if}
			<div class="min-w-0 flex-1 space-y-1">
				{#if service.display_id}
					<span class="font-mono text-xs text-muted-foreground">
						{service.display_id}
					</span>
				{/if}
				<div class="flex items-center justify-between gap-2">
					<p class="font-semibold truncate">
						{#if showClientName}
							{service.profiles?.name || m.unknown_client()}
						{:else}
							{service.pickup_location} &rarr; {service.delivery_location}
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<Tooltip.Root delayDuration={200}>
							<Tooltip.Trigger class="cursor-help">
								<Badge
									variant="outline"
									class="shrink-0 {service.status === 'pending'
										? 'border-blue-500 text-blue-500'
										: 'border-green-500 text-green-500'}"
								>
									{getStatusLabel(service.status)}
								</Badge>
							</Tooltip.Trigger>
							<Tooltip.Content>
								<p>{statusTooltip}</p>
							</Tooltip.Content>
						</Tooltip.Root>
						{#if headerActions}
							{@render headerActions()}
						{/if}
					</div>
				</div>
				{#if urgencyBadge}
					{@render urgencyBadge()}
				{/if}
				{#if showRequestStatus && service.request_status && service.request_status !== 'accepted'}
					<div class="flex items-center gap-2">
						<Badge
							variant="outline"
							class={getRequestStatusColor(service.request_status)}
						>
							{getRequestStatusLabel(service.request_status)}
						</Badge>
						{#if extraContent}
							{@render extraContent()}
						{/if}
					</div>
				{/if}
				{#if showClientName}
					<p class="text-sm text-muted-foreground truncate">
						{service.pickup_location} &rarr; {service.delivery_location}
					</p>
				{/if}
				{#if service.scheduled_date}
					<p class="flex items-center gap-1 text-sm font-medium text-foreground">
						<CalendarClock class="size-3.5 shrink-0" />
						{formatDate(service.scheduled_date)}
						{#if service.scheduled_time_slot}
							— {service.scheduled_time_slot === 'specific' && service.scheduled_time ? service.scheduled_time : formatTimeSlot(service.scheduled_time_slot)}
						{/if}
					</p>
				{/if}
				{#if service.notes}
					<p class="text-sm text-amber-600 truncate">{service.notes}</p>
				{/if}
				<p class="text-xs text-muted-foreground/60">
					{#if showDeliveredAt && service.delivered_at}
						{m.client_delivered_at({ datetime: formatDateTime(service.delivered_at) })}
					{:else}
						{formatDate(service.created_at)}
					{/if}
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
