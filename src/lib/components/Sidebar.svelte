<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { type NavItem, isItemActive } from '$lib/types/navigation.js';
	import * as m from '$lib/paraglide/messages.js';
	import SidebarItem from './SidebarItem.svelte';

	interface SidebarProps {
		items: NavItem[];
		currentPath: string;
		initialCollapsed?: boolean;
	}

	let { items, currentPath, initialCollapsed = false }: SidebarProps = $props();

	// svelte-ignore state_referenced_locally - intentionally capturing initial value for one-time initialization
	let collapsed = $state(initialCollapsed);

	function toggleCollapsed() {
		collapsed = !collapsed;
		document.cookie = `sidebar-collapsed=${collapsed}; path=/; max-age=31536000; SameSite=Lax`;
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
				<span>{m.sidebar_collapse()}</span>
			{/if}
		</Button>
	</div>
</aside>
