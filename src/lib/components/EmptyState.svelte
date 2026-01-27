<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Component } from 'svelte';

	let {
		icon,
		title,
		description,
		actionLabel,
		actionHref,
		onAction
	}: {
		icon?: Component<{ class?: string }>;
		title: string;
		description?: string;
		actionLabel?: string;
		actionHref?: string;
		onAction?: () => void;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
	{#if icon}
		{@const Icon = icon}
		<Icon class="size-12 text-muted-foreground mb-4" />
	{/if}
	<h3 class="text-lg font-semibold">{title}</h3>
	{#if description}
		<p class="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
	{/if}
	{#if actionLabel && (actionHref || onAction)}
		<Button variant="outline" class="mt-4" href={actionHref} onclick={onAction}>
			{actionLabel}
		</Button>
	{/if}
</div>
