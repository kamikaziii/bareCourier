<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { type NavItem, isItemActive } from '$lib/types/navigation.js';
	import SidebarItem from './SidebarItem.svelte';

	interface SidebarProps {
		items: NavItem[];
		currentPath: string;
	}

	let { items, currentPath }: SidebarProps = $props();

	// Load initial state from localStorage
	const STORAGE_KEY = 'sidebar-collapsed';
	let collapsed = $state(false);

	// Initialize from localStorage on mount
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored !== null) {
				collapsed = stored === 'true';
			}
		}
	});

	function toggleCollapsed() {
		collapsed = !collapsed;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, String(collapsed));
		}
	}
</script>

<aside
	class="hidden md:flex flex-col border-r bg-background transition-all duration-300 ease-in-out
		sticky top-0 h-screen overflow-y-auto
		{collapsed ? 'w-16' : 'w-56'}"
>
	<!-- Navigation items -->
	<nav class="flex-1 space-y-1 p-2">
		{#each items as item (item.href)}
			<SidebarItem
				href={item.href}
				label={item.label}
				icon={item.icon}
				badge={item.badge}
				isActive={isItemActive(item.href, currentPath)}
				{collapsed}
			/>
		{/each}
	</nav>

	<!-- Collapse toggle -->
	<div class="border-t p-2">
		<Button
			variant="ghost"
			size="sm"
			class="w-full {collapsed ? 'justify-center px-0' : ''}"
			onclick={toggleCollapsed}
		>
			{#if collapsed}
				<ChevronRight class="size-4" />
			{:else}
				<ChevronLeft class="size-4 mr-2" />
				<span>Collapse</span>
			{/if}
		</Button>
	</div>
</aside>
