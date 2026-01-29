<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, MapPin, CheckCircle } from '@lucide/svelte';

	interface Props {
		isOutOfZone: boolean | null;
		detectedMunicipality: string | null;
		checkingZone: boolean;
		onOverride: (outOfZone: boolean) => void;
		disabled?: boolean;
	}

	let {
		isOutOfZone,
		detectedMunicipality,
		checkingZone,
		onOverride,
		disabled = false
	}: Props = $props();

	let showManualOverride = $state(false);
</script>

{#if checkingZone}
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<div class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		<span>{m.loading()}</span>
	</div>
{:else if isOutOfZone === null && !detectedMunicipality}
	<!-- Detection failed - show manual override -->
	<div class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
		<div class="flex items-start gap-2">
			<AlertTriangle class="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<div class="flex-1 space-y-2">
				<p class="text-sm text-amber-800 dark:text-amber-200">
					{m.zone_detection_failed()}
				</p>
				{#if !showManualOverride}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (showManualOverride = true)}
						{disabled}
					>
						{m.zone_manual_select()}
					</Button>
				{:else}
					<div class="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-950/50"
							onclick={() => onOverride(false)}
							{disabled}
						>
							<CheckCircle class="mr-1 size-3 text-green-600" />
							{m.mark_in_zone()}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/50"
							onclick={() => onOverride(true)}
							{disabled}
						>
							<MapPin class="mr-1 size-3 text-amber-600" />
							{m.mark_out_of_zone()}
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{:else if isOutOfZone === true}
	<div class="flex items-center gap-2">
		<Badge variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
			<MapPin class="mr-1 size-3" />
			{m.out_of_zone()}
		</Badge>
		{#if detectedMunicipality}
			<span class="text-xs text-muted-foreground">({detectedMunicipality})</span>
		{/if}
	</div>
{:else if isOutOfZone === false}
	<div class="flex items-center gap-2">
		<Badge variant="secondary" class="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
			<CheckCircle class="mr-1 size-3" />
			{m.in_zone()}
		</Badge>
		{#if detectedMunicipality}
			<span class="text-xs text-muted-foreground">({detectedMunicipality})</span>
		{/if}
	</div>
{/if}
