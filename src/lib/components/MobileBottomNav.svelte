<script lang="ts">
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { MoreHorizontal } from '@lucide/svelte';
	import { type NavItem, isItemActive } from '$lib/types/navigation.js';
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
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="flex items-center justify-around">
		{#each mainItems as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isItemActive(item.href, currentPath)}
			<a
				href={localizeHref(item.href)}
				class="flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors
					{active ? 'text-primary' : 'text-muted-foreground'}"
			>
				<Icon class="size-5" />
				<span class="truncate">{item.label}</span>
			</a>
		{/each}

		{#if moreItems.length > 0}
			<button
				onclick={() => (drawerOpen = true)}
				class="flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors
					{isMoreActive ? 'text-primary' : 'text-muted-foreground'}"
			>
				<MoreHorizontal class="size-5" />
				<span>More</span>
			</button>
		{/if}
	</div>
</nav>

{#if moreItems.length > 0}
	<MoreDrawer items={moreItems} {currentPath} bind:open={drawerOpen} />
{/if}
