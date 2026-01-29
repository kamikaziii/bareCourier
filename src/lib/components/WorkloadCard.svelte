<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown, ChevronUp, Clock, MapPin, AlertTriangle, CheckCircle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';

	interface Props {
		workload: WorkloadEstimate;
	}

	let { workload }: Props = $props();
	let expanded = $state(false);

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	const statusBg = $derived(
		workload.status === 'comfortable'
			? 'bg-green-50 dark:bg-green-950/30'
			: workload.status === 'tight'
				? 'bg-yellow-50 dark:bg-yellow-950/30'
				: 'bg-red-50 dark:bg-red-950/30'
	);

	const statusColor = $derived(
		workload.status === 'comfortable'
			? 'text-green-600'
			: workload.status === 'tight'
				? 'text-yellow-600'
				: 'text-red-600'
	);

	const statusMessage = $derived(
		workload.status === 'comfortable'
			? m.workload_status_comfortable({ hours: formatTime(workload.bufferMinutes) })
			: workload.status === 'tight'
				? m.workload_status_tight({ hours: formatTime(workload.bufferMinutes) })
				: m.workload_status_overloaded({ hours: formatTime(Math.abs(workload.bufferMinutes)) })
	);
</script>

<Card.Root class={statusBg}>
	<Card.Header class="pb-2">
		<Card.Title class="flex items-center gap-2 text-base">
			{#if workload.status === 'comfortable'}
				<CheckCircle class="size-5 {statusColor}" />
			{:else if workload.status === 'tight'}
				<Clock class="size-5 {statusColor}" />
			{:else}
				<AlertTriangle class="size-5 {statusColor}" />
			{/if}
			{m.workload_title()}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex items-center gap-4 text-sm text-muted-foreground">
			<span>{workload.totalServices} {m.workload_services()}</span>
			<span>•</span>
			<span>{workload.totalDistanceKm} km</span>
		</div>

		<div class="space-y-1 text-sm">
			<div class="flex justify-between">
				<span class="text-muted-foreground">{m.workload_driving()}</span>
				<span>{formatTime(workload.drivingTimeMinutes)}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-muted-foreground">{m.workload_service_time()}</span>
				<span>{formatTime(workload.serviceTimeMinutes)}</span>
			</div>
			{#if workload.breakTimeMinutes > 0}
				<div class="flex justify-between">
					<span class="text-muted-foreground">{m.workload_breaks()}</span>
					<span>{formatTime(workload.breakTimeMinutes)}</span>
				</div>
			{/if}
			<div class="border-t pt-1 flex justify-between font-medium">
				<span>{m.workload_total_needed()}</span>
				<span>{formatTime(workload.totalTimeMinutes)}</span>
			</div>
		</div>

		<div class="flex items-center gap-2 pt-1 {statusColor}">
			{#if workload.status === 'comfortable'}
				<CheckCircle class="size-4" />
			{:else if workload.status === 'tight'}
				<Clock class="size-4" />
			{:else}
				<AlertTriangle class="size-4" />
			{/if}
			<span class="text-sm font-medium">{statusMessage}</span>
		</div>

		{#if workload.services.length > 0}
			<Collapsible.Root bind:open={expanded}>
				<Collapsible.Trigger class="w-full mt-2">
					<Button variant="ghost" size="sm" class="w-full">
						{expanded ? m.workload_hide_details() : m.workload_show_details()}
						{#if expanded}
							<ChevronUp class="size-4 ml-1" />
						{:else}
							<ChevronDown class="size-4 ml-1" />
						{/if}
					</Button>
				</Collapsible.Trigger>
				<Collapsible.Content>
					<div class="space-y-2 mt-2 pt-2 border-t">
						{#each workload.services as service}
							<div class="text-xs space-y-0.5">
								<div class="font-medium">{service.clientName}</div>
								<div class="flex items-center gap-1 text-muted-foreground">
									<MapPin class="size-3" />
									<span class="truncate">{service.deliveryLocation}</span>
								</div>
								<div class="flex gap-2 text-muted-foreground">
									{#if service.distanceKm}
										<span>{service.distanceKm} km</span>
									{/if}
									{#if service.drivingMinutes}
										<span>~{service.drivingMinutes}m drive</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</Collapsible.Content>
			</Collapsible.Root>
		{/if}
	</Card.Content>
</Card.Root>
