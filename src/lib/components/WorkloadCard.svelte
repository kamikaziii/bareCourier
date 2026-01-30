<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronDown, ChevronUp, MapPin, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';
	import { getWorkloadStyles } from '$lib/services/workload-styles.js';
	import { formatMinutesToHuman } from '$lib/utils.js';

	interface Props {
		workload: WorkloadEstimate;
		loading?: boolean;
	}

	let { workload, loading = false }: Props = $props();
	let cardExpanded = $state(false);
	let detailsExpanded = $state(false);

	const servicesLabel = $derived(
		workload.totalServices === 1 ? m.workload_service_singular() : m.workload_service_plural()
	);

	const styles = $derived(getWorkloadStyles(workload.status));
	const StatusIcon = $derived(styles.icon);

	const statusMessage = $derived(
		workload.status === 'comfortable'
			? m.workload_status_comfortable({ hours: formatMinutesToHuman(workload.bufferMinutes) })
			: workload.status === 'tight'
				? m.workload_status_tight({ hours: formatMinutesToHuman(workload.bufferMinutes) })
				: m.workload_status_overloaded({ hours: formatMinutesToHuman(Math.abs(workload.bufferMinutes)) })
	);
</script>

<Collapsible.Root bind:open={cardExpanded}>
	<Card.Root class="{styles.bg} {cardExpanded ? '' : '!py-0 !gap-0'} {loading ? 'opacity-50' : ''}">
		<Collapsible.Trigger class="w-full text-left" disabled={loading}>
			<Card.Header class={cardExpanded ? "pb-2" : "py-3 !grid-rows-1 !gap-0"}>
				<Card.Title class="flex items-center justify-between text-base">
					<span class="flex items-center gap-2">
						{#if loading}
							<Loader2 class="size-5 animate-spin {styles.text}" />
						{:else}
							<StatusIcon class="size-5 {styles.text}" />
						{/if}
						{m.workload_title()}
					</span>
					<span class="flex items-center gap-2 text-sm font-normal text-muted-foreground">
						{#if cardExpanded}
							<ChevronUp class="size-4" />
						{:else}
							<ChevronDown class="size-4" />
						{/if}
					</span>
				</Card.Title>
			</Card.Header>
		</Collapsible.Trigger>
		<Collapsible.Content>
			<Card.Content class="space-y-3 pt-0">
				<div class="flex justify-between text-sm text-muted-foreground">
					<span>{workload.totalServices} {servicesLabel}</span>
					<span>{workload.totalDistanceKm} km</span>
				</div>

				<div class="space-y-1 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.workload_driving()}</span>
						<span>{formatMinutesToHuman(workload.drivingTimeMinutes)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">{m.workload_service_time()}</span>
						<span>{formatMinutesToHuman(workload.serviceTimeMinutes)}</span>
					</div>
					{#if workload.breakTimeMinutes > 0}
						<div class="flex justify-between">
							<span class="text-muted-foreground">{m.workload_breaks()}</span>
							<span>{formatMinutesToHuman(workload.breakTimeMinutes)}</span>
						</div>
					{/if}
					<div class="border-t pt-1 flex justify-between font-medium">
						<span>{m.workload_total_needed()}</span>
						<span>{formatMinutesToHuman(workload.totalTimeMinutes)}</span>
					</div>
				</div>

				<div class="flex items-center gap-2 pt-1 {styles.text}">
					<StatusIcon class="size-4" />
					<span class="text-sm font-medium">{statusMessage}</span>
				</div>

				{#if workload.services.length > 0}
					<Collapsible.Root bind:open={detailsExpanded}>
						<Collapsible.Trigger class="w-full mt-2">
							<Button variant="ghost" size="sm" class="w-full">
								{detailsExpanded ? m.workload_hide_details() : m.workload_show_details()}
								{#if detailsExpanded}
									<ChevronUp class="size-4 ml-1" />
								{:else}
									<ChevronDown class="size-4 ml-1" />
								{/if}
							</Button>
						</Collapsible.Trigger>
						<Collapsible.Content>
							<div class="space-y-2 mt-2 pt-2 border-t">
								{#each workload.services as service (service.id)}
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
												<span>{m.workload_drive_time({ time: formatMinutesToHuman(service.drivingMinutes) })}</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				{/if}
			</Card.Content>
		</Collapsible.Content>
	</Card.Root>
</Collapsible.Root>
