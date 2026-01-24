<script lang="ts">
	import type { Component } from 'svelte';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import SidebarItem from './SidebarItem.svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
	}

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

	// Check if item is active (exact match or starts with for nested routes)
	function isItemActive(itemHref: string): boolean {
		if (currentPath === itemHref) return true;
		// For nested routes, check if current path starts with item href
		// But don't match parent if we're on an exact child route
		if (itemHref !== '/' && currentPath.startsWith(itemHref + '/')) return true;
		return false;
	}
</script>

<aside
	class="hidden md:flex flex-col border-r bg-background transition-all duration-300 ease-in-out
		{collapsed ? 'w-16' : 'w-56'}"
>
	<!-- Navigation items -->
	<nav class="flex-1 space-y-1 p-2">
		{#each items as item (item.href)}
			<SidebarItem
				href={item.href}
				label={item.label}
				icon={item.icon}
				isActive={isItemActive(item.href)}
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
