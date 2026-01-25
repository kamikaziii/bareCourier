<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { AlertCircle, Clock, AlertTriangle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		calculateUrgency,
		getTimeRemaining,
		type ServiceForUrgency,
		type UrgencyLevel
	} from '$lib/utils/past-due.js';

	interface UrgencyBadgeProps {
		service: ServiceForUrgency;
		showTimeRemaining?: boolean;
		size?: 'sm' | 'default';
	}

	let { service, showTimeRemaining = false, size = 'default' }: UrgencyBadgeProps = $props();

	const urgency = $derived(calculateUrgency(service));
	const timeRemaining = $derived(showTimeRemaining ? getTimeRemaining(service) : null);

	// Badge configuration based on urgency level
	const badgeConfig: Record<
		UrgencyLevel,
		{
			show: boolean;
			label: string;
			class: string;
			icon: typeof AlertCircle | typeof Clock | typeof AlertTriangle | null;
		}
	> = {
		on_track: {
			show: false,
			label: '',
			class: '',
			icon: null
		},
		approaching: {
			show: true,
			label: m.urgency_approaching?.() ?? 'Due Soon',
			class: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
			icon: Clock
		},
		urgent: {
			show: true,
			label: m.urgency_urgent?.() ?? 'Due Soon',
			class: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
			icon: Clock
		},
		past_due: {
			show: true,
			label: m.urgency_past_due?.() ?? 'Past Due',
			class: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
			icon: AlertCircle
		},
		critical: {
			show: true,
			label: m.urgency_critical?.() ?? 'Critical',
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
	<Badge
		variant="outline"
		class="inline-flex items-center gap-1 font-medium border {config.class} {sizeClasses}"
	>
		{#if Icon}
			<Icon class={size === 'sm' ? 'size-3' : 'size-3.5'} />
		{/if}
		<span>{timeRemaining || config.label}</span>
	</Badge>
{/if}
