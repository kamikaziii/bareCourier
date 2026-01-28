<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { AlertCircle, Clock, AlertTriangle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		calculateUrgency,
		getTimeRemaining,
		type ServiceForUrgency,
		type UrgencyLevel,
		type PastDueConfig
	} from '$lib/utils/past-due.js';

	interface UrgencyBadgeProps {
		service: ServiceForUrgency;
		showTimeRemaining?: boolean;
		size?: 'sm' | 'default';
		config?: PastDueConfig;
	}

	let { service, showTimeRemaining = false, size = 'default', config: pastDueConfig }: UrgencyBadgeProps = $props();

	const urgency = $derived(calculateUrgency(service, pastDueConfig));
	const timeRemaining = $derived(showTimeRemaining ? getTimeRemaining(service, pastDueConfig) : null);

	// Badge configuration based on urgency level
	const badgeConfig: Record<
		UrgencyLevel,
		{
			show: boolean;
			label: string;
			tooltip: string;
			class: string;
			icon: typeof AlertCircle | typeof Clock | typeof AlertTriangle | null;
		}
	> = {
		on_track: {
			show: false,
			label: '',
			tooltip: '',
			class: '',
			icon: null
		},
		approaching: {
			show: true,
			label: m.urgency_approaching(),
			tooltip: m.urgency_approaching_tooltip(),
			class: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
			icon: Clock
		},
		urgent: {
			show: true,
			label: m.urgency_urgent(),
			tooltip: m.urgency_urgent_tooltip(),
			class: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
			icon: Clock
		},
		past_due: {
			show: true,
			label: m.urgency_past_due(),
			tooltip: m.urgency_past_due_tooltip(),
			class: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
			icon: AlertCircle
		},
		critical: {
			show: true,
			label: m.urgency_critical(),
			tooltip: m.urgency_critical_tooltip(),
			class: 'bg-red-200 text-red-900 border-red-300 hover:bg-red-200',
			icon: AlertTriangle
		}
	};

	const config = $derived(badgeConfig[urgency]);
	const Icon = $derived(config.icon);

	const sizeClasses = $derived(
		size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : 'text-xs px-2 py-0.5'
	);
</script>

{#if config.show}
	<Tooltip.Root delayDuration={200}>
		<Tooltip.Trigger class="cursor-help">
			<Badge
				variant="outline"
				class="inline-flex items-center gap-1 font-medium border {config.class} {sizeClasses}"
			>
				{#if Icon}
					<Icon class={size === 'sm' ? 'size-3' : 'size-3.5'} />
				{/if}
				<span>{timeRemaining || config.label}</span>
			</Badge>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{config.tooltip}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
