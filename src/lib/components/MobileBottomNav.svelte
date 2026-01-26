<script lang="ts">
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import { MoreHorizontal } from '@lucide/svelte';
	import { type NavItem, isItemActive } from '$lib/types/navigation.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import MoreDrawer from './MoreDrawer.svelte';

	interface MobileBottomNavProps {
		mainItems: NavItem[];
		moreItems?: NavItem[];
		currentPath: string;
	}

	let { mainItems, moreItems = [], currentPath }: MobileBottomNavProps = $props();

	let drawerOpen = $state(false);

	// Check if any "more" item is active
	const isMoreActive = $derived(moreItems.some((item) => isItemActive(item.href, currentPath)));

	// Check if any "more" item has a badge
	const moreBadgeCount = $derived(
		moreItems.reduce((sum, item) => sum + (item.badge || 0), 0)
	);

	function formatBadge(count: number | undefined): string | null {
		if (!count || count <= 0) return null;
		if (count > 9) return '9+';
		return count.toString();
	}
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="flex items-center justify-around">
		{#each mainItems as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isItemActive(item.href, currentPath)}
			{@const displayBadge = formatBadge(item.badge)}
			<a
				href={localizeHref(item.href)}
				class="flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors
					{active ? 'text-primary' : 'text-muted-foreground'}"
				aria-label={displayBadge ? `${item.label}, ${item.badge} pending` : item.label}
			>
				<span class="relative">
					<Icon class="size-5" />
					{#if displayBadge}
						<Badge
							variant="destructive"
							class="absolute -top-1.5 -right-2.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-mono tabular-nums flex items-center justify-center"
						>
							{displayBadge}
						</Badge>
					{/if}
				</span>
				<span class="truncate">{item.label}</span>
			</a>
		{/each}

		{#if moreItems.length > 0}
			{@const moreDisplayBadge = formatBadge(moreBadgeCount)}
			<button
				onclick={() => (drawerOpen = true)}
				class="flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors
					{isMoreActive ? 'text-primary' : 'text-muted-foreground'}"
				aria-label={moreDisplayBadge ? `${m.nav_more()}, ${moreBadgeCount} pending` : m.nav_more()}
			>
				<span class="relative">
					<MoreHorizontal class="size-5" />
					{#if moreDisplayBadge}
						<Badge
							variant="destructive"
							class="absolute -top-1.5 -right-2.5 h-4 min-w-4 rounded-full px-1 text-[10px] font-mono tabular-nums flex items-center justify-center"
						>
							{moreDisplayBadge}
						</Badge>
					{/if}
				</span>
				<span>{m.nav_more()}</span>
			</button>
		{/if}
	</div>
</nav>

{#if moreItems.length > 0}
	<MoreDrawer items={moreItems} {currentPath} bind:open={drawerOpen} />
{/if}
