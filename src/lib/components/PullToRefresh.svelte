<script lang="ts">
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { Loader2, ArrowDown } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	type Snippet = import('svelte').Snippet;

	let { children }: { children: Snippet } = $props();

	let pullDistance = $state(0);
	let isRefreshing = $state(false);
	let isPulling = $state(false);

	const threshold = 80; // pixels to pull before triggering refresh
	const maxPull = 120; // max pull distance
	let startY = $state(0);
	let isTracking = $state(false);

	function handleTouchStart(e: TouchEvent) {
		// Only activate when at top of page
		if (!browser || window.scrollY !== 0) return;

		startY = e.touches[0].clientY;
		isTracking = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isTracking || isRefreshing) return;

		const currentY = e.touches[0].clientY;
		const diff = currentY - startY;

		// Only pull down, not up
		if (diff > 0 && window.scrollY === 0) {
			// Apply resistance - less movement as you pull further
			pullDistance = Math.min(diff * 0.5, maxPull);
			isPulling = true;

			// Prevent default to stop page scroll
			if (pullDistance > 10) {
				e.preventDefault();
			}
		}
	}

	function handleTouchEnd() {
		if (!isTracking) return;

		isTracking = false;

		if (pullDistance >= threshold && !isRefreshing) {
			// Trigger refresh
			refresh();
		} else {
			// Reset
			isPulling = false;
			pullDistance = 0;
		}
	}

	async function refresh() {
		isRefreshing = true;
		pullDistance = 60; // Keep some visible distance during refresh

		try {
			await invalidateAll();
		} catch (err) {
			console.error('Refresh failed:', err);
		}

		// Small delay for visual feedback
		setTimeout(() => {
			isRefreshing = false;
			isPulling = false;
			pullDistance = 0;
		}, 300);
	}

	const progress = $derived(Math.min(pullDistance / threshold, 1));
	const shouldRelease = $derived(pullDistance >= threshold);
</script>

<div
	class="pull-to-refresh-container"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- Pull indicator -->
	{#if isPulling || isRefreshing}
		<div
			class="pull-indicator flex items-center justify-center"
			style="height: {pullDistance}px; opacity: {progress}"
		>
			{#if isRefreshing}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 class="size-5 animate-spin" />
					<span>{m.refreshing()}</span>
				</div>
			{:else if shouldRelease}
				<div class="flex items-center gap-2 text-sm text-primary">
					<ArrowDown class="size-5 rotate-180" />
					<span>{m.release_to_refresh()}</span>
				</div>
			{:else}
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<ArrowDown class="size-5" style="transform: rotate({180 * progress}deg)" />
					<span>{m.pull_to_refresh()}</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Content -->
	<div
		class="pull-content"
		style="transform: translateY({isPulling || isRefreshing ? pullDistance : 0}px); transition: {isTracking ? 'none' : 'transform 0.2s ease-out'}"
	>
		{@render children()}
	</div>
</div>

<style>
	.pull-to-refresh-container {
		position: relative;
		overflow: hidden;
		touch-action: pan-y;
	}

	.pull-indicator {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		overflow: hidden;
		background: var(--background);
	}

	.pull-content {
		will-change: transform;
	}
</style>
