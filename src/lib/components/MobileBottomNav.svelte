<script lang="ts">
	import type { Component } from 'svelte';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import MoreDrawer from './MoreDrawer.svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

	interface MobileBottomNavProps {
		mainItems: NavItem[];
		moreItems?: NavItem[];
		currentPath: string;
	}

	let { mainItems, moreItems = [], currentPath }: MobileBottomNavProps = $props();

	let drawerOpen = $state(false);

	// Check if item is active
	function isItemActive(itemHref: string): boolean {
		if (currentPath === itemHref) return true;
		if (itemHref !== '/' && currentPath.startsWith(itemHref + '/')) return true;
		return false;
	}

	// Check if any "more" item is active
	const isMoreActive = $derived(moreItems.some((item) => isItemActive(item.href)));
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="flex items-center justify-around">
		{#each mainItems as item (item.href)}
			{@const Icon = item.icon}
			{@const active = isItemActive(item.href)}
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
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="1" />
					<circle cx="19" cy="12" r="1" />
					<circle cx="5" cy="12" r="1" />
				</svg>
				<span>More</span>
			</button>
		{/if}
	</div>
</nav>

{#if moreItems.length > 0}
	<MoreDrawer items={moreItems} {currentPath} bind:open={drawerOpen} />
{/if}
