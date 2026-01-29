<script lang="ts">
	import { Coffee, Play } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { startBreak, endBreak, getCurrentBreak, type CurrentBreak } from '$lib/services/breaks.js';

	interface Props {
		supabase: SupabaseClient;
		courierId: string;
	}

	let { supabase, courierId }: Props = $props();

	let currentBreak = $state<CurrentBreak | null>(null);
	let loading = $state(false);
	let elapsedMinutes = $state(0);

	// Load initial state
	$effect(() => {
		loadBreakStatus();
	});

	// Update elapsed time every minute when on break
	$effect(() => {
		if (!currentBreak) return;

		const interval = setInterval(() => {
			if (currentBreak) {
				elapsedMinutes = Math.floor((Date.now() - currentBreak.startedAt.getTime()) / 60000);
			}
		}, 60000);

		return () => clearInterval(interval);
	});

	async function loadBreakStatus() {
		currentBreak = await getCurrentBreak(supabase, courierId);
		if (currentBreak) {
			elapsedMinutes = currentBreak.elapsedMinutes;
		}
	}

	async function toggleBreak() {
		loading = true;
		if (currentBreak) {
			await endBreak(supabase, courierId);
		} else {
			await startBreak(supabase, courierId, 'manual', 'toggle');
		}
		await loadBreakStatus();
		loading = false;
	}

	function formatElapsed(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours}h ${mins}m`;
	}
</script>

<div
	class="flex items-center justify-between px-4 py-2 border-b text-sm
		{currentBreak ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-background'}"
>
	<div class="flex items-center gap-2">
		{#if currentBreak}
			<Coffee class="size-4 text-amber-600" />
			<span class="font-medium text-amber-700 dark:text-amber-400">
				{m.workload_on_break()} ({formatElapsed(elapsedMinutes)})
			</span>
		{:else}
			<div class="size-2 rounded-full bg-green-500"></div>
			<span class="text-muted-foreground">{m.workload_working()}</span>
		{/if}
	</div>

	<Button
		variant="ghost"
		size="sm"
		onclick={toggleBreak}
		disabled={loading}
		class="h-7 px-2 text-xs"
	>
		{#if currentBreak}
			<Play class="size-3 mr-1" />
			{m.workload_resume()}
		{:else}
			<Coffee class="size-3 mr-1" />
			{m.workload_take_break()}
		{/if}
	</Button>
</div>
