<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { WorkloadEstimate } from '$lib/services/workload.js';
	import { getWorkloadStyles } from '$lib/services/workload-styles.js';
	import { formatMinutesToHuman } from '$lib/utils.js';

	interface Props {
		workload: WorkloadEstimate;
		dateLabel?: string;
		compact?: boolean;
	}

	let { workload, dateLabel, compact = false }: Props = $props();
	let expanded = $state(false);

	const servicesLabel = $derived(
		workload.totalServices === 1 ? m.workload_service_singular() : m.workload_service_plural()
	);

	const styles = $derived(getWorkloadStyles(workload.status));
	const StatusIcon = $derived(styles.icon);

	const statusLabel = $derived(
		workload.status === 'comfortable'
			? m.workload_status_comfortable_short()
			: workload.status === 'tight'
				? m.workload_status_tight_short()
				: m.workload_status_overloaded_short()
	);

	const bufferText = $derived(
		workload.bufferMinutes >= 0
			? m.workload_buffer({ time: formatMinutesToHuman(workload.bufferMinutes) })
			: m.workload_status_overloaded({ hours: formatMinutesToHuman(Math.abs(workload.bufferMinutes)) })
	);
</script>

{#if compact}
	<!-- Compact mode: single line, no expand -->
	<div class="flex items-center gap-2 text-sm {styles.bg} rounded-md px-2 py-1">
		<StatusIcon class="size-4 {styles.text}" />
		<span class={styles.text}>{statusLabel}</span>
		<span class="text-muted-foreground">·</span>
		<span class="text-muted-foreground">{workload.totalServices} {servicesLabel}</span>
	</div>
{:else}
	<!-- Full mode: expandable -->
	<Collapsible.Root bind:open={expanded}>
		<div class="{styles.bg} rounded-lg overflow-hidden">
			<Collapsible.Trigger class="w-full text-left px-3 py-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if dateLabel}
							<span class="text-sm font-medium">{dateLabel}</span>
						{/if}
						<StatusIcon class="size-4 {styles.text}" />
						<span class="text-sm {styles.text}">{statusLabel}</span>
						<span class="text-sm text-muted-foreground">·</span>
						<span class="text-sm text-muted-foreground">{workload.totalServices} {servicesLabel}</span>
						<span class="text-sm text-muted-foreground">·</span>
						<span class="text-sm text-muted-foreground">{bufferText}</span>
					</div>
					{#if expanded}
						<ChevronUp class="size-4 text-muted-foreground" />
					{:else}
						<ChevronDown class="size-4 text-muted-foreground" />
					{/if}
				</div>
			</Collapsible.Trigger>
			<Collapsible.Content>
				<div class="px-3 pb-3 pt-1 border-t border-border/50">
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
				</div>
			</Collapsible.Content>
		</div>
	</Collapsible.Root>
{/if}
