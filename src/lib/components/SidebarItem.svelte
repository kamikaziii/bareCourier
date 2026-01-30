<script lang="ts">
	import type { Component } from 'svelte';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { formatBadge } from '$lib/utils.js';

	interface SidebarItemProps {
		href: string;
		label: string;
		icon: Component;
		isActive: boolean;
		collapsed: boolean;
		badge?: number | PromiseLike<number>;
	}

	let { href, label, icon: Icon, isActive, collapsed, badge }: SidebarItemProps = $props();
</script>

<a
	href={localizeHref(href)}
	class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
		{isActive
		? 'bg-accent text-accent-foreground'
		: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}
		{collapsed ? 'justify-center' : ''}"
	title={collapsed ? label : undefined}
	aria-label={label}
>
	<span class="relative">
		<Icon class="size-5 shrink-0" />
		{#if badge !== undefined && collapsed}
			{#if typeof badge === 'number'}
				{@const displayBadge = formatBadge(badge)}
				{#if displayBadge}
					<Badge
						variant="destructive"
						class="absolute -top-2 -right-2.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-mono tabular-nums flex items-center justify-center"
					>
						{displayBadge}
					</Badge>
				{/if}
			{:else}
				{#await badge then count}
					{@const displayBadge = formatBadge(count)}
					{#if displayBadge}
						<Badge
							variant="destructive"
							class="absolute -top-2 -right-2.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-mono tabular-nums flex items-center justify-center"
						>
							{displayBadge}
						</Badge>
					{/if}
				{/await}
			{/if}
		{/if}
	</span>
	{#if !collapsed}
		<span class="flex-1 truncate">{label}</span>
		{#if badge !== undefined}
			{#if typeof badge === 'number'}
				{@const displayBadge = formatBadge(badge)}
				{#if displayBadge}
					<Badge
						variant="destructive"
						class="h-5 min-w-5 rounded-full px-1.5 text-xs font-mono tabular-nums flex items-center justify-center"
					>
						{displayBadge}
					</Badge>
				{/if}
			{:else}
				{#await badge then count}
					{@const displayBadge = formatBadge(count)}
					{#if displayBadge}
						<Badge
							variant="destructive"
							class="h-5 min-w-5 rounded-full px-1.5 text-xs font-mono tabular-nums flex items-center justify-center"
						>
							{displayBadge}
						</Badge>
					{/if}
				{/await}
			{/if}
		{/if}
	{/if}
</a>
